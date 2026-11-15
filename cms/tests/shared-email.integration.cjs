const assert=require('node:assert/strict');

module.exports=async function sharedEmailTests({app,request,password,adminToken,basic,sentEmails}) {
  const email='family@local.invalid';const childPassword=password+'child';
  const query=app.db.query('plugin::users-permissions.user');
  const confirm=async username=>{
    const pending=await query.findOne({where:{username}});assert.equal(pending.confirmed,false);
    assert.equal((await request('/api/auth/email-confirmation?confirmation='+pending.confirmationToken)).status,302);
  };
  const verifiedSignup=async data=>{
    const created=await request('/api/auth/local/register',data);assert.equal(created.body.requiresConfirmation,true);assert.equal(created.body.jwt,undefined);
    await confirm(data.username);return request('/api/auth/local',{identifier:data.username,password:data.password});
  };
  const parent=await verifiedSignup({username:'Parent.Martin',email,password,firstName:'Parent',lastName:'Martin'});
  assert.equal(parent.status,200,JSON.stringify(parent.body));
  const child=await verifiedSignup({username:'enfant.martin',email,password:childPassword,firstName:'Enfant',lastName:'Martin'});
  assert.equal(child.status,200,JSON.stringify(child.body));
  assert.notEqual(parent.body.user.id,child.body.user.id);
  const duplicate=await request('/api/auth/local/register',{username:'enfant.martin',email:'another@local.invalid',password});
  assert.equal(duplicate.status,400);
  const adminCreated=await request('/content-manager/collection-types/plugin::users-permissions.user',{username:'autre.enfant',email,password,firstName:'Autre',lastName:'Enfant',role:basic.id,confirmed:true},adminToken);
  assert.equal(adminCreated.status,201,JSON.stringify(adminCreated.body));
  const other=await verifiedSignup({username:'profil.partage',email:'before@local.invalid',password});
  assert.equal(other.status,200);
  const updated=await request('/api/member/profile',{email},other.body.jwt,'PUT');
  assert.equal(updated.status,200,JSON.stringify(updated.body));assert.equal(updated.body.username,'profil.partage');assert.equal(updated.body.emailConfirmed,false);await confirm('profil.partage');
  // An old account whose username is its original email keeps that identifier.
  const legacy=await verifiedSignup({username:'legacy@local.invalid',email:'legacy@local.invalid',password});
  assert.equal(legacy.status,200);
  assert.equal((await request('/api/member/profile',{email},legacy.body.jwt,'PUT')).body.username,'legacy@local.invalid');
  await confirm('legacy@local.invalid');
  assert.equal((await request('/api/auth/local',{identifier:'legacy@local.invalid',password})).body.user.id,legacy.body.user.id);
  const selection=await request('/api/auth/local',{identifier:' FAMILY@LOCAL.INVALID ',password});
  assert.equal(selection.status,200,JSON.stringify(selection.body));assert.equal(selection.body.jwt,undefined);
  assert.equal(selection.body.user,undefined);assert.equal(selection.body.accounts.length,5);
  for(const account of selection.body.accounts)assert.deepEqual(Object.keys(account).sort(),['firstName','id','lastName','username']);
  assert.equal((await request('/api/auth/local',{identifier:email})).body.accounts.length,5);
  assert.equal((await request('/api/auth/local',{identifier:email,password,accountId:child.body.user.id})).status,400);
  assert.equal((await request('/api/auth/local',{identifier:email,password:childPassword,accountId:child.body.user.id})).body.user.id,child.body.user.id);
  assert.equal((await request('/api/auth/local',{identifier:email,password,accountId:parent.body.user.id})).body.user.id,parent.body.user.id);
  assert.equal((await request('/api/auth/local',{identifier:'Parent.Martin',password})).body.user.id,parent.body.user.id);
  assert.equal((await request('/api/auth/local',{identifier:'enfant.martin',password:childPassword})).body.user.id,child.body.user.id);
  assert.equal((await request('/api/auth/local',{identifier:email,password,accountId:2147483647})).status,400);
  assert.equal((await request('/api/auth/local',{identifier:email,password,accountId:{$ne:0}})).status,400);
  assert.equal((await request('/api/auth/local',{identifier:'Parent.Martin',password,accountId:child.body.user.id})).status,400);
  await app.plugin('users-permissions').service('user').edit(child.body.user.id,{blocked:true});
  assert.equal((await request('/api/auth/local',{identifier:email,password:childPassword,accountId:child.body.user.id})).status,400);
  assert.equal((await request('/api/auth/local',{identifier:'enfant.martin',password:childPassword})).status,400);
  const before=sentEmails.length;
  assert.equal((await request('/api/auth/forgot-password',{email})).status,200);
  const messages=sentEmails.slice(before);assert.equal(messages.length,4);
  const tokens=[];
  for(const message of messages) {
    assert.equal(message.to,email);
    const code=new URL(message.html.match(/href="([^"]+)"/)[1]).searchParams.get('code');tokens.push(code);
    const user=await query.findOne({where:{resetPasswordToken:code}});
    assert(user);assert(message.html.includes(user.username));assert.notEqual(user.id,child.body.user.id);
  }
  assert.equal(new Set(tokens).size,4);
  assert.equal((await query.findOne({where:{id:child.body.user.id}})).resetPasswordToken,null);
  const parentMessage=messages.find(message=>message.html.includes('Parent.Martin'));
  const parentCode=new URL(parentMessage.html.match(/href="([^"]+)"/)[1]).searchParams.get('code');
  assert.equal((await request('/api/auth/reset-password',{code:parentCode,password:password+'reset',passwordConfirmation:password+'reset'})).status,200);
  assert.equal((await request('/api/auth/local',{identifier:'Parent.Martin',password})).status,400);
  await app.plugin('users-permissions').service('user').edit(child.body.user.id,{blocked:false});
  assert.equal((await request('/api/auth/local',{identifier:'enfant.martin',password:childPassword})).status,200);
  const advanced=app.store({type:'plugin',name:'users-permissions',key:'advanced'});const previous=await advanced.get();
  try {
    await advanced.set({value:{...previous,email_confirmation:true}});
    const pending=await request('/api/auth/local/register',{username:'pending.family',email,password});
    assert.equal(pending.status,200,JSON.stringify(pending.body));assert.equal(pending.body.requiresConfirmation,true);assert.equal(pending.body.jwt,undefined);
    assert.equal((await request('/api/auth/local',{identifier:'pending.family',password})).status,400);
  }finally{await advanced.set({value:previous});}
  console.log('OK : emails partagés (inscription, administration, profil), choix obligatoire du compte, mot de passe propre à chaque compte, identifiants directs et stables, blocage, confirmation et récupération distincte.');
  return {email,username:'enfant.martin',password:childPassword,childId:child.body.user.id,parentId:parent.body.user.id};
};
