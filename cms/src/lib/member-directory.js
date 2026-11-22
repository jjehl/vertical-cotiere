const {fields,memberDateFields}=require('./member-profile');
const {emailKey,phoneKey}=require('./member-identity');
const {memberTypes}=require('./member-roles');
const uid='plugin::users-permissions.user';
const memberSelect=['id','username','email',...Object.keys(fields),'confirmed','blocked','createdAt','updatedAt',...memberDateFields,'competition','provider','registrationInviteSentAt'];
const rolePopulate={role:{select:['type','name']}};
const sortFields=['lastName','firstName','username','email','phone','postalCode','city','ffmeLicenseNumber','createdAt','confirmed','blocked','role'];
function authorize(ctx) {
  ctx.set('Cache-Control','private, no-store');
  ctx.set('Vary','Authorization');
  if(!ctx.state.user||ctx.state.user.blocked||ctx.state.user.role?.type!=='member_admin')ctx.throw(403,'Accès réservé aux administrateurs membres.');
}
function memberDto(row) {
  return Object.fromEntries([...memberSelect.map(key=>[key,row[key]??null]),['role',row.role?.type==='member_admin'?'admin':row.role?.type==='contributor'?'contributor':'basic']]);
}
function integer(ctx,value,fallback,max) {
  if(value===undefined)return fallback;
  if(typeof value!=='string'||!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)<1||Number(value)>max)ctx.throw(400,'Pagination invalide.');
  return Number(value);
}
async function list(app,ctx) {
  authorize(ctx);
  // URL serializers may encode empty filters as bare keys, which Strapi parses as null.
  const q=ctx.query.q??'',role=ctx.query.role??'',status=ctx.query.status??'';
  const memberType=ctx.query.memberType??'';
  const {sort='lastName',direction='asc'}=ctx.query;
  if(!['','competitor','climber','contact'].includes(memberType)||typeof q!=='string'||q.length>120||!sortFields.includes(sort)||!['asc','desc'].includes(direction)||!['','basic','contributor','admin'].includes(role)||!['','active','unconfirmed','blocked','contact'].includes(status))ctx.throw(400,'Filtres ou tri invalides.');
  const page=integer(ctx,ctx.query.page,1,1000000);
  const pageSize=integer(ctx,ctx.query.pageSize,25,100);
  const where={role:{type:role?{basic:'authenticated',contributor:'contributor',admin:'member_admin'}[role]:{$in:memberTypes}}};
  if(memberType) {
    const {tableName,attributes}=app.db.metadata.get(uid);
    const membersOfType=app.db.connection(tableName).select('id').whereRaw(`CASE
      WHEN NULLIF(TRIM(??), '') IS NULL THEN 'contact'
      WHEN ?? THEN 'competitor'
      ELSE 'climber' END = ?`,[attributes.ffmeLicenseNumber.columnName,attributes.competition.columnName,memberType]);
    where.id={$in:membersOfType};
  }
  if(status==='blocked')where.blocked=true;
  if(status==='active')Object.assign(where,{blocked:false,confirmed:true});
  if(status==='unconfirmed')Object.assign(where,{blocked:false,confirmed:false,provider:{$ne:'contact'}});
  if(status==='contact')where.provider='contact';
  if(q.trim()) {
    const terms=q.trim().split(/\s+/).map(value=>({$or:['firstName','lastName','username','email','phone','city','postalCode','ffmeLicenseNumber'].map(key=>({[key]:{$containsi:value}}))}));
    if (/^[+0-9 ()./-]+$/.test(q) && /\d/.test(q)) {
      // Phone searches also accept a compact number, a prefix or the international form.
      const digits=q.replace(/[^+0-9]/g,'').replace(/^00/,'+').replace(/^\+330?/,'0');
      const {tableName,attributes}=app.db.metadata.get(uid);
      const matches=app.db.connection(tableName).select('id').whereRaw("replace(??, ' ', '') LIKE ?",[attributes.phone.columnName,'%'+digits+'%']);
      where.$or=[{$and:terms},{id:{$in:matches}}];
    } else where.$and=terms;
  }
  const query=app.db.query(uid);
  const [rows,total]=await Promise.all([
    query.findMany({where,select:memberSelect,populate:rolePopulate,orderBy:[sort==='role'?{role:{name:direction}}:{[sort]:direction},{id:'asc'}],offset:(page-1)*pageSize,limit:pageSize}),
    query.count({where}),
  ]);
  ctx.body={members:rows.map(memberDto),pagination:{page,pageSize,total,pageCount:Math.ceil(total/pageSize)}};
}
const personSelect=['id','firstName','lastName','username','email'];
const registrationSelect=['id','reference','season','slotCode','slotLabel','firstName','lastName','birthDate','email','address','promoCode','familyReference','amountCents','registrationStatus','payerFirstName','payerLastName','payerEmail','checkoutIntentId','checkoutCreatedAt','confirmedAt','createdAt','updatedAt','memberCreated'];
function unmatchedSecondContact(sheet,guardians) {
  const email=String(sheet?.secondEmail??'').trim()||null;
  const phone=String(sheet?.secondPhone??'').trim()||null;
  if (!email && !phone) return null;
  const normalizedEmail=emailKey(email);
  const normalizedPhone=phoneKey(phone);
  const linked=guardians.some(person=>
    (!email || normalizedEmail===emailKey(person.email)) &&
    (!phone || (normalizedPhone && normalizedPhone===phoneKey(person.phone))));
  return linked ? null : {email,phone};
}
async function details(app,ctx) {
  authorize(ctx);
  if(!/^[1-9]\d*$/.test(ctx.params.id)||!Number.isSafeInteger(Number(ctx.params.id)))ctx.throw(404,'Membre introuvable.');
  const id=Number(ctx.params.id);
  const familyMember={where:{role:{type:{$in:memberTypes}}},select:[...personSelect,'phone']};
  const row=await app.db.query(uid).findOne({where:{id,role:{type:{$in:memberTypes}}},select:[...memberSelect,'membershipSheet','password','googleSubject'],
    populate:{...rolePopulate,guardians:familyMember,dependents:familyMember}});
  if(!row)ctx.throw(404,'Membre introuvable.');
  // Match account relations, never shared e-mail addresses: a family may have several accounts.
  const [registrations,participations]=await Promise.all([
    app.db.query('api::course-registration.course-registration').findMany({where:{$or:[{member:id},{payer:id}]},select:registrationSelect,populate:{member:{select:personSelect},payer:{select:personSelect}},orderBy:[{createdAt:'desc'},{id:'desc'}]}),
    app.db.query('api::event-participation.event-participation').findMany({where:{member:id},select:['id','confirmedAt'],populate:{poll:{select:['publicationDocumentId']},registeredByMember:{select:personSelect}},orderBy:[{confirmedAt:'desc'},{id:'desc'}]}),
  ]);
  const documentIds=[...new Set(participations.map(item=>item.poll?.publicationDocumentId).filter(Boolean))];
  const publications=documentIds.length?await app.documents('api::publication.publication').findMany({status:'published',filters:{documentId:{$in:documentIds}},fields:['documentId','title','slug'],populate:{meeting:true},limit:documentIds.length}):[];
  const publicationsById=new Map(publications.map(item=>[item.documentId,item]));
  ctx.body={member:memberDto(row),canEditEmail:canEditEmail(row),guardians:row.guardians,dependents:row.dependents,
    secondGuardianContact:unmatchedSecondContact(row.membershipSheet,row.guardians),
    registrations:registrations.map(item=>({...Object.fromEntries(registrationSelect.map(key=>[key,item[key]??null])),member:item.member||null,payer:item.payer||null,isParticipant:item.member?.id===id,isPayer:item.payer?.id===id})),participations:participations.map(item=>{
    const publication=publicationsById.get(item.poll?.publicationDocumentId);
    return {id:item.id,confirmedAt:item.confirmedAt,registeredByMember:item.registeredByMember||null,title:publication?.title||'Événement indisponible',url:publication?'/vie-du-club/'+encodeURIComponent(publication.slug):null,start:publication?.meeting?.start||null,location:publication?.meeting?.location||null};
  })};
}
function canEditEmail(row) {
  return row.provider === 'contact' || (!row.confirmed && !row.password && !row.googleSubject);
}
module.exports={list,details,authorize,canEditEmail};
