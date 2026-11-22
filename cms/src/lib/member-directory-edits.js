const {randomUUID} = require('node:crypto');
const {authorize, canEditEmail} = require('./member-directory');
const {fields,memberDateFields,validityDates} = require('./member-profile');
const {nameKey, validDate} = require('./member-identity');
const {memberTypes} = require('./member-roles');

const uid = 'plugin::users-permissions.user';
const scope = {role:{type:{$in:memberTypes}}};

async function write(app, ctx, action) {
  authorize(ctx);
  ctx.body = await app.db.transaction(async ({trx}) => {
    // Serialize identity checks and family changes with registration and workbook imports.
    await trx.raw('SELECT pg_advisory_xact_lock(2672027)');
    return action(app.db.query(uid),trx);
  });
}

function checkKeys(ctx, input, allowed) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      Object.keys(input).some(key => !allowed.includes(key))) ctx.throw(400,'Champs de la demande invalides.');
}

async function findMember(users, ctx, id) {
  if (!Number.isSafeInteger(id) || id < 1) ctx.throw(404,'Membre introuvable.');
  const member = await users.findOne({where:{...scope,id}});
  if (!member) ctx.throw(404,'Membre introuvable.');
  return member;
}

async function profileChanges(users, ctx, input, member = {}) {
  checkKeys(ctx,input,[...Object.keys(fields),'email',...memberDateFields,'competition']);
  const data = {};
  for (const [key,value] of Object.entries(input)) {
    if (key === 'competition') {
      if (typeof value !== 'boolean') ctx.throw(400,'Valeur de compétition invalide.');
      data.competition = value;
    } else if (memberDateFields.includes(key)) {
      if (value !== null && value !== '' && (typeof value !== 'string' || !validDate(value))) ctx.throw(400,(validityDates[key] || 'Date de naissance')+' invalide.');
      data[key] = value || null;
    } else {
      if (typeof value !== 'string' || value.trim().length > (key === 'email' ? 254 : fields[key])) ctx.throw(400,'Un champ est invalide ou trop long.');
      data[key] = value.trim() || null;
    }
  }
  if (data.email) {
    data.email = data.email.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) ctx.throw(400,'Adresse e-mail invalide.');
  }
  const next = {...member,...data};
  if (!(next.firstName && next.lastName) && !next.email && !next.phone) ctx.throw(400,'Indiquez le prénom et le nom, un e-mail ou un téléphone.');
  if (member.provider === 'local' && !next.email) ctx.throw(400,'Une adresse e-mail est requise pour ce compte.');
  if (member.id && Object.hasOwn(data,'email') && data.email !== member.email) {
    if (!canEditEmail(member)) ctx.throw(400,'Le membre change son e-mail de connexion depuis son profil.');
    Object.assign(data,{resetPasswordToken:null,resetPasswordExpiresAt:null,confirmationToken:null,
      registrationInviteToken:null,registrationInviteExpiresAt:null,registrationInviteSentAt:null});
  }
  if (next.firstName && next.lastName && next.membershipBirthDate &&
      (!member.id || nameKey(next) !== nameKey(member) || next.membershipBirthDate !== member.membershipBirthDate)) {
    const sameDate = await users.findMany({where:{...scope,membershipBirthDate:next.membershipBirthDate},select:['id','firstName','lastName']});
    if (sameDate.some(person => person.id !== member.id && nameKey(person) === nameKey(next))) ctx.throw(409,'Une fiche existe déjà pour ce nom, ce prénom et cette date de naissance.');
  }
  return data;
}

async function create(app, users, ctx, input) {
  const data = await profileChanges(users,ctx,input);
  const role = await app.db.query('plugin::users-permissions.role').findOne({where:{type:'authenticated'}});
  const provider = data.firstName && data.lastName && data.email ? 'local' : 'contact';
  return users.create({data:{...data,username:'adherent.'+randomUUID(),provider,role:role.id,confirmed:false,blocked:false},select:['id']});
}

function createMember(app, ctx) {
  return write(app,ctx,users => create(app,users,ctx,ctx.request.body));
}

function updateMember(app, ctx) {
  return write(app,ctx,async (users,trx) => {
    const id = Number(ctx.params.id);
    if (!Number.isSafeInteger(id) || id < 1) ctx.throw(404,'Membre introuvable.');
    // Activation can run concurrently. Check email editability against the locked account.
    await trx(app.db.metadata.get(uid).tableName).select('id').where({id}).forUpdate();
    const member = await findMember(users,ctx,id);
    const data = await profileChanges(users,ctx,ctx.request.body,member);
    if (Object.keys(data).length) await users.update({where:{id:member.id},data});
    return {id:member.id};
  });
}

function deleteMember(app, ctx) {
  return write(app,ctx,async users => {
    const member = await findMember(users,ctx,Number(ctx.params.id));
    if (member.id === ctx.state.user.id) ctx.throw(409,'Vous ne pouvez pas supprimer votre propre compte administrateur.');
    await users.delete({where:{id:member.id}});
    return {id:member.id};
  });
}

function editFamily(app, ctx) {
  return write(app,ctx,async users => {
    const subject = await findMember(users,ctx,Number(ctx.params.id));
    const body = ctx.request.body;
    checkKeys(ctx,body,['relation','previousId','memberId','newMember']);
    const {relation,previousId,memberId,newMember} = body;
    if (!['guardians','dependents'].includes(relation) ||
        (memberId !== undefined && newMember !== undefined) ||
        [memberId,previousId].some(id => id !== undefined && (!Number.isSafeInteger(id) || id <= 0)) ||
        (previousId === undefined && memberId === undefined && newMember === undefined)) ctx.throw(400,'Lien familial invalide.');
    if (memberId === subject.id) ctx.throw(400,'Une fiche ne peut pas être liée à elle-même.');
    function link(childOrGuardianId, operation) {
      const [child,guardian] = relation === 'guardians' ? [subject.id,childOrGuardianId] : [childOrGuardianId,subject.id];
      return users.update({where:{id:child},data:{guardians:{[operation]:[guardian]}}});
    }
    if (previousId !== undefined) {
      if (!await users.findOne({where:{...scope,id:previousId,[relation === 'guardians' ? 'dependents' : 'guardians']:subject.id},select:['id']})) ctx.throw(409,'Ce lien a déjà été modifié. Actualisez la fiche.');
      await link(previousId,'disconnect');
    }
    if (memberId !== undefined || newMember !== undefined) {
      const person = newMember !== undefined ? await create(app,users,ctx,newMember) : await findMember(users,ctx,memberId);
      await link(person.id,'connect');
    }
    return {id:subject.id};
  });
}

module.exports = {createMember,updateMember,deleteMember,editFamily};
