const {fields}=require('./member-profile');
const {memberTypes}=require('./member-roles');
const uid='plugin::users-permissions.user';
const memberSelect=['id','username','email',...Object.keys(fields),'confirmed','blocked','createdAt','updatedAt','membershipBirthDate','provider','registrationInviteSentAt'];
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
  const {sort='lastName',direction='asc'}=ctx.query;
  if(typeof q!=='string'||q.length>120||!sortFields.includes(sort)||!['asc','desc'].includes(direction)||!['','basic','contributor','admin'].includes(role)||!['','active','unconfirmed','blocked'].includes(status))ctx.throw(400,'Filtres ou tri invalides.');
  const page=integer(ctx,ctx.query.page,1,1000000);
  const pageSize=integer(ctx,ctx.query.pageSize,25,100);
  const where={role:{type:role?{basic:'authenticated',contributor:'contributor',admin:'member_admin'}[role]:{$in:memberTypes}}};
  if(status==='blocked')where.blocked=true;
  if(status==='active')Object.assign(where,{blocked:false,confirmed:true});
  if(status==='unconfirmed')Object.assign(where,{blocked:false,confirmed:false});
  if(q.trim())where.$and=q.trim().split(/\s+/).map(value=>({$or:['firstName','lastName','username','email','phone','city','postalCode','ffmeLicenseNumber'].map(key=>({[key]:{$containsi:value}}))}));
  const query=app.db.query(uid);
  const [rows,total]=await Promise.all([
    query.findMany({where,select:memberSelect,populate:rolePopulate,orderBy:[sort==='role'?{role:{name:direction}}:{[sort]:direction},{id:'asc'}],offset:(page-1)*pageSize,limit:pageSize}),
    query.count({where}),
  ]);
  ctx.body={members:rows.map(memberDto),pagination:{page,pageSize,total,pageCount:Math.ceil(total/pageSize)}};
}
const personSelect=['id','firstName','lastName','username','email'];
const registrationSelect=['id','reference','season','slotCode','slotLabel','firstName','lastName','birthDate','email','address','promoCode','familyReference','amountCents','registrationStatus','payerFirstName','payerLastName','payerEmail','checkoutIntentId','checkoutCreatedAt','confirmedAt','createdAt','updatedAt','memberCreated'];
async function details(app,ctx) {
  authorize(ctx);
  if(!/^[1-9]\d*$/.test(ctx.params.id)||!Number.isSafeInteger(Number(ctx.params.id)))ctx.throw(404,'Membre introuvable.');
  const id=Number(ctx.params.id);
  const row=await app.db.query(uid).findOne({where:{id,role:{type:{$in:memberTypes}}},select:memberSelect,populate:rolePopulate});
  if(!row)ctx.throw(404,'Membre introuvable.');
  // Match account relations, never shared e-mail addresses: a family may have several accounts.
  const [registrations,participations]=await Promise.all([
    app.db.query('api::course-registration.course-registration').findMany({where:{$or:[{member:id},{payer:id}]},select:registrationSelect,populate:{member:{select:personSelect},payer:{select:personSelect}},orderBy:[{createdAt:'desc'},{id:'desc'}]}),
    app.db.query('api::event-participation.event-participation').findMany({where:{member:id},select:['id','confirmedAt'],populate:{poll:{select:['publicationDocumentId']},registeredByMember:{select:personSelect}},orderBy:[{confirmedAt:'desc'},{id:'desc'}]}),
  ]);
  const documentIds=[...new Set(participations.map(item=>item.poll?.publicationDocumentId).filter(Boolean))];
  const publications=documentIds.length?await app.documents('api::publication.publication').findMany({status:'published',filters:{documentId:{$in:documentIds}},fields:['documentId','title','slug'],populate:{meeting:true},limit:documentIds.length}):[];
  const publicationsById=new Map(publications.map(item=>[item.documentId,item]));
  ctx.body={member:memberDto(row),registrations:registrations.map(item=>({...Object.fromEntries(registrationSelect.map(key=>[key,item[key]??null])),member:item.member||null,payer:item.payer||null,isParticipant:item.member?.id===id,isPayer:item.payer?.id===id})),participations:participations.map(item=>{
    const publication=publicationsById.get(item.poll?.publicationDocumentId);
    return {id:item.id,confirmedAt:item.confirmedAt,registeredByMember:item.registeredByMember||null,title:publication?.title||'Événement indisponible',url:publication?'/vie-du-club/'+encodeURIComponent(publication.slug):null,start:publication?.meeting?.start||null,location:publication?.meeting?.location||null};
  })};
}
module.exports={list,details};
