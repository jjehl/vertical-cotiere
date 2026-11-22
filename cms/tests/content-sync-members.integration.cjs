const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
module.exports=async({app,request,sourceToken,targetToken,run,options})=>{
  const uid='plugin::users-permissions.user',users=app.db.query(uid),roles=app.db.query('plugin::users-permissions.role');
  for(const type of ['contributor','member_admin'])if(!await roles.findOne({where:{type}}))await roles.create({data:{type,name:type}});
  const role=await roles.findOne({where:{type:'contributor'}});
  const makeToken=async(name,actions)=>(await app.service('admin::api-token').create({name,type:'custom',lifespan:null,permissions:actions.map(action=>'api::content-sync.content-sync.'+action)})).accessKey;
  const read=await makeToken('members-read',['membersExport']);
  const write=await makeToken('members-write',['membersPlan','membersImport']);
  const user=await app.plugin('users-permissions').service('user').add({username:'member.transfer',email:'shared@example.test',password:'Password-to-transfer-2026',provider:'local',role:role.id,firstName:'Camille',confirmed:true,blocked:false});
  await users.update({where:{id:user.id},data:{googleSubject:'google-not-transferred',resetPasswordToken:'reset-not-transferred',registrationInviteToken:'invite-not-transferred',membershipBirthDate:'1990-01-01'}});
  assert.equal((await request('members/export',null,sourceToken)).status,403);
  assert.equal((await request('members/export',null,write)).status,403);
  assert.equal((await request('members/plan',{},targetToken)).status,403);
  assert.equal((await request('export?type=members',null,read)).status,403);
  // Even a member role explicitly granted the action may not use a JWT here.
  await app.db.query('plugin::users-permissions.permission').create({data:{role:role.id,action:'api::content-sync.content-sync.membersExport'}});
  const jwt=app.plugin('users-permissions').service('jwt').issue({id:user.id});
  assert.equal((await request('members/export',null,jwt)).status,403);
  const exported=await request('members/export?pageSize=25',null,read);assert.equal(exported.status,200,JSON.stringify(exported.body));
  const content=exported.body.contents.find(item=>item.documentId===user.documentId);assert(content);
  assert(!JSON.stringify(content).includes('not-transferred'));
  assert.equal(content.draft.membershipBirthDate,'1990-01-01');
  const body={content};
  assert.equal((await request('members/plan',body,write)).status,400); // same instance
  content.sourceId='independent-members-source';
  assert.equal((await request('members/plan',body,write)).body.action,'conflict'); // username
  assert.equal((await request('plan',body,targetToken)).status,400); // editorial scope cannot import members
  assert.equal((await request('members/plan',{...body,adoptSlug:true},write)).status,400);
  await users.update({where:{id:user.id},data:{username:'original.member.transfer'}});
  const count=await users.count();
  assert.equal((await request('members/plan',body,write)).body.action,'create');assert.equal(await users.count(),count);
  const first=await request('members/import',body,write);assert.equal(first.status,200,JSON.stringify(first.body));assert.equal(first.body.action,'create');
  const target=await users.findOne({where:{documentId:first.body.documentId},populate:{role:true}});assert(target);assert.notEqual(target.id,user.id);assert.notEqual(target.documentId,user.documentId);
  assert.equal(target.role.type,'contributor');assert.equal(target.googleSubject,null);assert.equal(target.resetPasswordToken,null);assert.equal(target.registrationInviteToken,null);
  assert(await app.plugin('users-permissions').service('user').validatePassword('Password-to-transfer-2026',target.password));
  assert.equal((await request('members/import',body,write)).body.action,'unchanged');
  const mapping=await require('../src/lib/content-sync-service').store(app,require('../src/lib/content-sync-members-model').key(content)).get();assert(!JSON.stringify(mapping).includes('$2'));
  await users.update({where:{id:target.id},data:{phone:'0600000000'}});content.draft.city='Lyon';
  assert.equal((await request('members/import',body,write)).body.action,'update');assert.equal((await users.findOne({where:{id:target.id}})).phone,'0600000000');
  await users.update({where:{id:target.id},data:{city:'Paris'}});content.draft.city='Bordeaux';
  const conflict=await request('members/import',body,write);assert.equal(conflict.body.action,'conflict');assert(conflict.body.conflicts.includes('city'));
  content.draft.city='Lyon';
  // A destination password reset is preserved on subsequent profile transfers.
  await app.plugin('users-permissions').service('user').edit(target.id,{password:'Destination-password-2026'});content.draft.firstName='Autre prénom';
  assert.equal((await request('members/import',body,write)).body.action,'update');
  assert(await app.plugin('users-permissions').service('user').validatePassword('Destination-password-2026',(await users.findOne({where:{id:target.id}})).password));
  const invalid=structuredClone(content);invalid.draft.role='super-admin';assert.equal((await request('members/import',{content:invalid},write)).status,400);
  // Persistence failure rolls back both the member and its baseline.
  const originalQuery=app.db.query.bind(app.db),changed=structuredClone(content);changed.draft.lastName=('Rollback-'+randomUUID()).toUpperCase();
  app.db.query=name=>{const query=originalQuery(name);return name==='strapi::core-store'?{...query,update:async params=>{if(params.data?.value?.includes(changed.draft.lastName))throw Error('Simulated member persistence failure');return query.update(params);}}:query;};
  try{assert.equal((await request('members/import',{content:changed},write)).status,500);}finally{app.db.query=originalQuery;}
  assert.notEqual((await users.findOne({where:{id:target.id}})).lastName,changed.draft.lastName);
  await users.delete({where:{id:target.id}});
  assert.equal((await request('members/import',body,write)).body.action,'conflict');
  console.log('OK membres : scopes dédiés, JWT refusés, profils et bcrypt, rôles, doublons, fusion, mot de passe cible conservé, relance, suppression et rollback.');
};
