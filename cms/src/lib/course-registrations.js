const {createHash,randomUUID,timingSafeEqual}=require('node:crypto');
const helloasso=require('./helloasso-checkout');
const uid='api::course-registration.course-registration';
const timetableUid='api::club-timetable.club-timetable';
const days=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const active={$in:['creating','pending','confirmed']};
const hash=value=>createHash('sha256').update(value).digest('hex');
const slotCode=slot=>slot.registrationCode||hash([slot.label,slot.day,slot.start,slot.end,slot.audience].join('|')).slice(0,24);
const query=app=>app.db.query(uid);
const plan=app=>app.documents(timetableUid).findFirst({status:'published',populate:{sessions:true}});
const prices=slot=>({STANDARD:slot.priceCents??null,CCMP1OU2:slot.ccmpPriceCents??null,FAM:slot.familyPriceCents??null,CCMP3:slot.ccmpFamilyPriceCents??null});
const validPrice=value=>Number.isSafeInteger(value)&&value>0;
const open=timetable=>!!timetable?.registrationsOpen&&(!timetable.registrationOpensAt||Date.parse(timetable.registrationOpensAt)<=Date.now());
function payer(ctx) {
  const user=ctx.state.user;
  if(!user)ctx.throw(401,'Connectez-vous pour inscrire un adhérent.');
  if(user.blocked||!require('./member-roles').memberTypes.includes(user.role?.type))ctx.throw(403,'Accès membre refusé.');
  if(user.confirmed!==true)ctx.throw(403,'Validez votre adresse e-mail avant de vous inscrire.');
  return user;
}
const populate={payer:{select:['id']},member:{select:['id','username','confirmed','registrationInviteSentAt']}};
// PostgreSQL locks serialize the capacity check and reservation across all CMS replicas.
const locked=(app,fn)=>app.db.transaction(async({trx})=>{await trx.raw('SELECT pg_advisory_xact_lock(2672027)');return fn();});
async function used(app,season,code) {
  return query(app).count({where:{season,slotCode:code,registrationStatus:active}});
}
async function catalog(app,ctx) {
  ctx.set('Cache-Control','no-store');
  const timetable=await plan(app);
  if(!timetable){ctx.body={season:'2026–2027',open:false,paymentReady:false,sessions:[]};return;}
  const sessions=await Promise.all((timetable.sessions||[]).map(async slot=>{
    const reserved=await used(app,timetable.season,slotCode(slot));
    const remaining=Number.isSafeInteger(slot.capacity)?Math.max(0,slot.capacity-(slot.occupiedPlaces||0)-reserved):null;
    return {code:slotCode(slot),label:slot.label,day:days.indexOf(slot.day)+1,start:slot.start.slice(0,5),end:slot.end.slice(0,5),audience:slot.audience,birthYears:slot.birthYears||'',supervised:slot.supervised,capacity:slot.capacity,remaining,prices:prices(slot),registrationEnabled:!!slot.registrationEnabled};
  }));
  ctx.body={season:timetable.season,open:open(timetable),opensAt:timetable.registrationOpensAt||null,paymentReady:helloasso.ready(),sessions};
}
function validateInput(ctx,user) {
  const body=ctx.request.body||{};
  if(!['self','other'].includes(body.participantMode))ctx.throw(400,'Choisissez la personne à inscrire.');
  if(Object.keys(body).some(key=>!['slotCode','firstName','lastName','birthDate','email','address','promoCode','familyReference','accepted','participantMode'].includes(key)))ctx.throw(400,'Paramètres d’inscription invalides.');
  const source=body.participantMode==='self'?{...body,firstName:user.firstName,lastName:user.lastName,email:user.email}:body;
  const fields={participantMode:body.participantMode};
  for(const [key,max] of Object.entries({slotCode:100,firstName:80,lastName:80,birthDate:10,email:254,address:500,promoCode:20,familyReference:500})) {
    const value=source[key]??'';
    if(typeof value!=='string'||value.trim().length>max)ctx.throw(400,'Merci de vérifier les informations saisies.');
    fields[key]=value.trim();
  }
  for(const key of ['firstName','lastName'])if(fields[key].length<2)ctx.throw(400,'Renseignez les nom et prénom de l’adhérent.');
  if(!user.firstName||!user.lastName)ctx.throw(400,'Complétez votre nom et votre prénom dans votre profil avant de payer.');
  if(!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).test(fields.email)||fields.address.length<5)ctx.throw(400,'Renseignez une adresse postale et un e-mail valides.');
  const date=new Date(fields.birthDate+'T12:00:00Z');
  if(!(/^\d{4}-\d{2}-\d{2}$/).test(fields.birthDate)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==fields.birthDate||date>new Date()||date.getUTCFullYear()<1900)ctx.throw(400,'Renseignez une date de naissance valide.');
  if(body.accepted!==true)ctx.throw(400,'Veuillez lire et accepter les modalités de la saison.');
  fields.promoCode=fields.promoCode.toUpperCase()||'STANDARD';
  if(!['STANDARD','CCMP1OU2','FAM','CCMP3'].includes(fields.promoCode))ctx.throw(400,'Choisissez un tarif valide.');
  if(['FAM','CCMP3'].includes(fields.promoCode)&&fields.familyReference.length<5)ctx.throw(400,'Indiquez les deux premières personnes inscrites de votre famille.');
  fields.email=fields.email.toLowerCase();
  return fields;
}
function statusDto(row) {
  const resumable=row.registrationStatus==='pending'&&row.checkoutCreatedAt&&Date.now()-Date.parse(row.checkoutCreatedAt)<14*60000;
  return {reference:row.reference,status:row.registrationStatus,firstName:row.firstName,lastName:row.lastName,email:row.email,slotLabel:row.slotLabel,amountCents:row.amountCents,checkoutUrl:resumable&&helloasso.allowedRedirect(row.checkoutUrl)?row.checkoutUrl:null,accountCreated:!!row.memberCreated,accountPending:row.registrationStatus==='confirmed'&&!row.member,invitationPending:!!row.memberCreated&&!!row.member&&!row.member.confirmed&&!row.member.registrationInviteSentAt};
}
async function checkout(app,ctx) {
  ctx.set('Cache-Control','no-store');
  const user=payer(ctx);
  const input=validateInput(ctx,user);
  if(!helloasso.ready())ctx.throw(503,'Le paiement n’est pas encore ouvert. Contactez le secrétariat.');
  const reservation=await locked(app,async()=>{
    const timetable=await plan(app);
    if(!open(timetable))ctx.throw(409,'Les inscriptions ne sont pas ouvertes.');
    const participantKey=hash([timetable.season,input.firstName.toLowerCase(),input.lastName.toLowerCase(),input.birthDate,input.email].join('|'));
    const previous=await query(app).findOne({where:{registrationStatus:active,season:timetable.season,$or:[{participantKey},...(input.participantMode==='self'?[{member:user.id}]:[])]},populate});
    if(previous){
      if(previous.payer?.id!==user.id)ctx.throw(409,'Un dossier existe déjà pour cet adhérent. Contactez le secrétariat avant de payer.');
      return {row:previous,existing:true};
    }
    const slot=timetable.sessions.find(slot=>slotCode(slot)===input.slotCode);
    if(!slot?.registrationEnabled||!Number.isSafeInteger(slot.capacity))ctx.throw(409,'Ce créneau n’est pas ouvert à l’inscription en ligne.');
    if(await used(app,timetable.season,input.slotCode)+(slot.occupiedPlaces||0)>=slot.capacity)ctx.throw(409,'Ce créneau est complet. Choisissez un autre horaire.');
    const amountCents=prices(slot)[input.promoCode];
    if(!validPrice(amountCents))ctx.throw(409,'Ce tarif n’est pas encore disponible pour ce créneau.');
    // Birth-year ranges in the planning are enforced when they are explicit.
    const years=(slot.birthYears||'').match(/\b(?:19|20)\d{2}\b/g)?.map(Number);
    const year=Number(input.birthDate.slice(0,4));
    if(years?.length&&(year<Math.min(...years)||year>Math.max(...years)))ctx.throw(400,'L’année de naissance ne correspond pas à ce cours. Contactez le secrétariat.');
    const {slotCode:code,participantMode,...person}=input;
    const row=await query(app).create({data:{...person,payer:user.id,...(participantMode==='self'?{member:user.id}:{}),payerFirstName:user.firstName,payerLastName:user.lastName,payerEmail:user.email,slotCode:code,slotLabel:slot.label+' · '+slot.day+' '+slot.start.slice(0,5)+'–'+slot.end.slice(0,5),season:timetable.season,participantKey,reference:randomUUID(),amountCents,registrationStatus:'creating'},populate});
    return {row,existing:false};
  });
  if(reservation.existing){ctx.body=statusDto(reservation.row);return;}
  const row=reservation.row;
  try {
    const intent=await helloasso.create(row);
    const saved=await query(app).update({where:{id:row.id},data:{checkoutIntentId:String(intent.id),checkoutUrl:intent.redirectUrl,checkoutCreatedAt:new Date().toISOString(),registrationStatus:'pending'},populate});
    ctx.body=statusDto(saved);
  }catch(error){
    // Only a definitive rejection can free a seat. A timeout may hide an accepted intent.
    if([400,401,403,404,409,422,429].includes(error.status))await query(app).update({where:{id:row.id},data:{registrationStatus:'cancelled'}});
    app.log.error('Initialisation HelloAsso impossible pour le dossier '+row.reference+' (vérifier ce dossier avant toute nouvelle tentative).');
    ctx.throw(503,'Le paiement n’a pas pu être lancé. Vérifiez le suivi de votre dossier avant de réessayer ou contactez le secrétariat.');
  }
}
async function provisionAccount(app,row) {
  try {
    row=await locked(app,async()=>{
      const fresh=await query(app).findOne({where:{id:row.id},populate});
      return require('./registration-accounts').attachMember(app,fresh);
    });
    await require('./registration-accounts').sendInvitation(app,row);
  }catch {app.log.error('Création ou invitation du compte à reprendre pour le dossier '+row.reference);}
  return query(app).findOne({where:{id:row.id},populate});
}
async function reconcile(app,row) {
  if(row.registrationStatus==='confirmed')return provisionAccount(app,row);
  if(!row.checkoutIntentId||row.registrationStatus==='cancelled')return row;
  const intent=await helloasso.get(row.checkoutIntentId);
  const order=intent.order;
  // Browser return codes and notification bodies are never proof of payment.
  // Do not subtract HelloAsso's voluntary contribution from the membership amount.
  const payments=order?.payments||[];
  const paid=payments.filter(p=>p.state==='Authorized'||(process.env.HELLOASSO_SANDBOX!=='false'&&p.state==='AuthorizedPreprod')).reduce((sum,p)=>sum+(p.amount||0),0);
  const metadata=intent.metadata||order?.metadata;
  const decoded=typeof metadata==='string'?JSON.parse(metadata):metadata;
  if(order&&decoded?.registrationReference===row.reference&&paid===row.amountCents) {
    const confirmed=await locked(app,async()=>{
      const fresh=await query(app).findOne({where:{id:row.id},populate});
      if(fresh.registrationStatus==='confirmed'||fresh.registrationStatus==='cancelled')return fresh;
      return query(app).update({where:{id:row.id},data:{registrationStatus:'confirmed',confirmedAt:new Date().toISOString()},populate});
    });
    return confirmed.registrationStatus==='confirmed'?provisionAccount(app,confirmed):confirmed;
  }
  return row;
}
async function status(app,ctx) {
  ctx.set('Cache-Control','no-store');
  const user=payer(ctx);
  const rows=await query(app).findMany({where:{payer:user.id},orderBy:{createdAt:'desc'},populate});
  const result=[];
  for(const row of rows){
    try{result.push(statusDto(['pending','confirmed'].includes(row.registrationStatus)?await reconcile(app,row):row));}
    catch{result.push({...statusDto(row),verificationUnavailable:true});}
  }
  ctx.body={registrations:result};
}
async function webhook(app,ctx) {
  const secret=process.env.HELLOASSO_WEBHOOK_TOKEN;
  const supplied=ctx.query.key;
  if(!secret||typeof supplied!=='string'||Buffer.byteLength(secret)!==Buffer.byteLength(supplied)||!timingSafeEqual(Buffer.from(secret),Buffer.from(supplied)))ctx.throw(403,'Notification refusée.');
  const data=ctx.request.body?.data;
  let metadata=ctx.request.body?.metadata||data?.metadata||data?.order?.metadata;
  try{if(typeof metadata==='string')metadata=JSON.parse(metadata);}catch{metadata=null;}
  if(typeof metadata?.registrationReference!=='string'){ctx.body={ok:true};return;}
  const row=await query(app).findOne({where:{reference:metadata.registrationReference},populate});
  if(row)await reconcile(app,row);
  ctx.body={ok:true};
}
module.exports={catalog,checkout,status,webhook,slotCode,validateInput,reconcile,prices,locked,activate:(app,ctx)=>require('./registration-accounts').activate(app,ctx)};
