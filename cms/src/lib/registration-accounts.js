const {createHash,randomBytes}=require('node:crypto');
const uid='plugin::users-permissions.user';
const hash=value=>createHash('sha256').update(value).digest('hex');
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const {allocateUsername}=require('./member-username');

// Called inside the reservation transaction, after the payment was verified.
async function attachMember(app,row) {
  if(row.member)return row;
  const users=app.db.query(uid);
  const {formatField}=require('./member-format');
  const matches=await users.findMany({where:{provider:'local',email:{$eqi:row.email},firstName:{$eqi:formatField('firstName',row.firstName)},lastName:{$eqi:formatField('lastName',row.lastName)}}});
  const candidates=matches.filter(user=>!user.membershipBirthDate||user.membershipBirthDate===row.birthDate);
  if(candidates.length>1)throw new Error('Plusieurs comptes correspondent à cet adhérent. Vérification du secrétariat requise.');
  let member=candidates[0];
  if(member?.blocked)throw new Error('Le compte de cet adhérent est bloqué.');
  let memberCreated=false;
  if(!member) {
    const role=await app.db.query('plugin::users-permissions.role').findOne({where:{type:'authenticated'}});
    if(!role)throw new Error('Rôle membre introuvable.');
    const username=await allocateUsername(users,row);
    member=await app.plugin('users-permissions').service('user').add({username,email:row.email,firstName:row.firstName,lastName:row.lastName,
      membershipBirthDate:row.birthDate,password:randomBytes(32).toString('hex'),provider:'local',confirmed:false,blocked:false,role:role.id});
    memberCreated=true;
  }
  return app.db.query('api::course-registration.course-registration').update({where:{id:row.id},data:{member:member.id,memberCreated},populate:{member:true,payer:true}});
}

async function sendInvitation(app,row) {
  if(!row.memberCreated||!row.member)return;
  const memberId=typeof row.member==='number'?row.member:row.member.id;
  // Distinct lock: sending an invitation does not block reservations of seats.
  await app.db.transaction(async({trx})=>{
    await trx.raw('SELECT pg_advisory_xact_lock(2672028, ?)',[memberId]);
    const user=await app.db.query(uid).findOne({where:{id:memberId}});
    if(!user||user.blocked||user.confirmed||user.registrationInviteSentAt)return;
    const site=(process.env.PUBLIC_SITE_URL||'').replace(/\/$/,'');
    if(!/^https?:\/\//.test(site))throw new Error('URL du site non configurée.');
    const token=randomBytes(32).toString('hex');
    const url=site+'/activer-mon-compte?code='+token;
    const message='<p>Bonjour '+escape(user.firstName)+',</p><p>Votre inscription à Vertical Côtière a été réglée. Votre compte membre a été créé.</p><p>Identifiant : <strong>'+escape(user.username)+'</strong></p><p><a href="'+escape(url)+'">Valider mon adresse e-mail et choisir mon mot de passe</a></p><p>Ce lien personnel est valable sept jours et ne peut être utilisé qu’une fois.</p><p>Si vous n’êtes pas concerné par cette inscription, contactez secretariat@vertical-cotiere.fr.</p>';
    await app.db.query(uid).update({where:{id:user.id},data:{registrationInviteToken:hash(token),registrationInviteExpiresAt:new Date(Date.now()+7*86400000).toISOString()}});
    await app.plugin('email').service('email').send({to:user.email,subject:'Votre compte membre — Vertical Côtière',text:message,html:message});
    await app.db.query(uid).update({where:{id:user.id},data:{registrationInviteSentAt:new Date().toISOString()}});
  });
}

async function activate(app,ctx) {
  ctx.set('Cache-Control','private, no-store');
  const body=ctx.request.body||{};
  if(Object.keys(body).some(key=>!['code','password','passwordConfirmation'].includes(key))||typeof body.code!=='string'||!/^[a-f0-9]{64}$/.test(body.code))ctx.throw(400,'Ce lien d’activation est invalide ou expiré.');
  if(typeof body.password!=='string'||body.password.length<12||Buffer.byteLength(body.password,'utf8')>72)ctx.throw(400,'Choisissez au moins 12 caractères (72 octets maximum).');
  if(body.password!==body.passwordConfirmation)ctx.throw(400,'Les mots de passe ne correspondent pas.');
  await app.db.transaction(async({trx})=>{
    const metadata=app.db.metadata.get(uid);
    await trx(metadata.tableName).where({[metadata.attributes.registrationInviteToken.columnName]:hash(body.code)}).forUpdate();
    const user=await app.db.query(uid).findOne({where:{registrationInviteToken:hash(body.code)}});
    if(!user||user.blocked||user.confirmed||!user.registrationInviteExpiresAt||Date.parse(user.registrationInviteExpiresAt)<=Date.now())ctx.throw(400,'Ce lien d’activation est invalide ou expiré. Contactez le secrétariat.');
    await app.plugin('users-permissions').service('user').edit(user.id,{password:body.password,confirmed:true,confirmationToken:null,registrationInviteToken:null,registrationInviteExpiresAt:null});
  });
  ctx.body={ok:true};
}
module.exports={attachMember,sendInvitation,activate};
