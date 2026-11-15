const assert=require('node:assert/strict');
const {randomBytes,createHash,createHmac}=require('node:crypto');
const {EventEmitter}=require('node:events');
const {Readable}=require('node:stream');
const https=require('node:https');
const {generateKeyPair,exportJWK,SignJWT,createLocalJWKSet}=require('jose');

module.exports=async function({app,request,basic,contributor,password}) {
  const google=require('../src/lib/member-google');
  const {publicKey,privateKey}=await generateKeyPair('RS256');
  const jwk={...await exportJWK(publicKey),kid:'google-test-key',alg:'RS256',use:'sig'};
  const keySet=createLocalJWKSet({keys:[jwk]});
  const clientId='member-test.apps.googleusercontent.com';const nonce=randomBytes(32).toString('base64url');
  const verifier=randomBytes(32).toString('base64url');const challenge=createHash('sha256').update(verifier).digest('base64url');
  const token=async(claims={},key=privateKey)=>new SignJWT({nonce,email:'new-google@local.invalid',email_verified:true,given_name:'Google',family_name:'Membre',...claims}).setProtectedHeader({alg:'RS256',kid:jwk.kid}).setSubject(claims.sub||'google-new-subject').setIssuer(claims.iss||'https://accounts.google.com').setAudience(claims.aud||clientId).setIssuedAt().setExpirationTime(claims.exp||'5m').sign(key);
  assert.equal((await google.verifyIdentity(await token(),{clientId,nonce},keySet)).sub,'google-new-subject');
  for(const claims of [{nonce:'wrong'},{email_verified:false},{aud:'other-client'},{iss:'https://evil.invalid'},{exp:1},{email:'invalid'},{azp:'other-client'}])await assert.rejects(()=>token(claims).then(jwt=>google.verifyIdentity(jwt,{clientId,nonce},keySet)));
  const foreign=await generateKeyPair('RS256');await assert.rejects(()=>token({},foreign.privateKey).then(jwt=>google.verifyIdentity(jwt,{clientId,nonce},keySet)));

  const previousEnv={GOOGLE_CLIENT_ID:process.env.GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET:process.env.GOOGLE_CLIENT_SECRET};
  const originalFetch=global.fetch;const originalGet=https.get;const codes=new Map();
  const query=app.db.query('plugin::users-permissions.user');const users=app.plugin('users-permissions').service('user');
  const auth={type:'plugin',name:'users-permissions',key:'advanced'};const advanced=await app.store(auth).get();
  try {
    delete process.env.GOOGLE_CLIENT_ID;delete process.env.GOOGLE_CLIENT_SECRET;
    assert.equal((await request('/api/auth/google/config')).body.enabled,false);
    assert.equal((await request('/api/auth/google/start',{})).status,503);
    process.env.GOOGLE_CLIENT_ID=clientId;process.env.GOOGLE_CLIENT_SECRET='google-secret-test-only';
    https.get=(url,...args)=>{
      if(String(url)!=='https://www.googleapis.com/oauth2/v3/certs')return originalGet.call(https,url,...args);
      const req=new EventEmitter();req.destroy=()=>{};
      queueMicrotask(()=>{const response=Readable.from([Buffer.from(JSON.stringify({keys:[jwk]}))]);response.statusCode=200;req.emit('response',response);});return req;
    };
    global.fetch=async(url,options)=>{
      if(String(url)!=='https://oauth2.googleapis.com/token')return originalFetch(url,options);
      assert.equal(options.body.get('client_secret'),'google-secret-test-only');
      assert.equal(options.body.get('redirect_uri'),process.env.PUBLIC_SITE_URL+'/api/member/google/callback');
      assert.equal(options.body.get('code_verifier'),verifier);
      const jwt=codes.get(options.body.get('code'));return new Response(JSON.stringify(jwt?{id_token:jwt}:{error:'invalid_grant'}),{status:jwt?200:400});
    };
    const callback=async(claims={})=>{const code=randomBytes(20).toString('hex');codes.set(code,await token(claims));return request('/api/auth/google/callback',{code,codeVerifier:verifier,nonce});};
    assert.equal((await request('/api/auth/google/config')).body.enabled,true);
    const start=await request('/api/auth/google/start',{state:nonce,nonce,codeChallenge:challenge});assert.equal(start.status,200);
    const authorization=new URL(start.body.url);assert.equal(authorization.origin,'https://accounts.google.com');assert.equal(authorization.searchParams.get('scope'),'openid email profile');assert.equal(authorization.searchParams.get('code_challenge_method'),'S256');assert.equal(authorization.searchParams.get('state'),nonce);assert(!authorization.searchParams.has('client_secret'));
    assert.equal((await request('/api/auth/google/start',{state:'invalid',nonce,codeChallenge:challenge})).status,400);
    assert.equal((await callback({nonce:'wrong'})).status,400);
    assert.equal((await callback({email_verified:false})).status,400);
    assert.equal((await request('/api/auth/google/callback',{code:'unknown',codeVerifier:verifier,nonce})).status,400);
    // Force a different configurable default: Google must still create a basic member.
    await app.store(auth).set({value:{...advanced,default_role:'contributor'}});
    const created=await callback();assert.equal(created.status,200,JSON.stringify(created.body));assert(created.body.jwt);
    const newUser=await query.findOne({where:{googleSubject:'google-new-subject'},populate:{role:true}});
    assert.equal(newUser.role.id,basic.id);assert.equal(newUser.firstName,'Google');assert.equal(newUser.confirmed,true);assert(!newUser.password);
    const profile=(await request('/api/member/me',null,created.body.jwt)).body;
    assert.equal(profile.role,'basic');assert.equal(profile.googleConnected,true);assert.equal(profile.hasPassword,false);assert(!JSON.stringify(profile).includes('google-new-subject'));
    assert.equal((await request('/api/member/publications',null,created.body.jwt)).status,403);
    const returning=await callback({email:'changed-google@local.invalid'});assert.equal(returning.status,200);assert.equal((await request('/api/member/me',null,returning.body.jwt)).body.id,newUser.id);
    assert.equal((await query.findOne({where:{id:newUser.id}})).email,'new-google@local.invalid');
    await users.edit(newUser.id,{blocked:true});assert.equal((await callback()).status,400);await users.edit(newUser.id,{blocked:false});

    const sharedEmail='google-family@local.invalid';
    const create=(username,extra={})=>users.add({username,email:sharedEmail,password,firstName:username,lastName:'Famille',provider:'local',confirmed:true,role:basic.id,...extra});
    const first=await create('google-parent',{role:contributor.id,ffmeLicenseNumber:'123456'});
    const second=await create('google-child');
    const blocked=await create('google-blocked',{blocked:true});const unconfirmed=await create('google-unconfirmed',{confirmed:false});
    const unrelated=await create('google-unrelated',{email:'unrelated@local.invalid'});
    const collision=await callback({sub:'family-google-subject',email:sharedEmail.toUpperCase()});
    assert.equal(collision.status,200);assert.equal(collision.body.requiresLink,true);assert(!collision.body.jwt);
    assert.equal(await query.count({where:{email:{$eqi:sharedEmail}}}),4);
    const pendingToken=collision.body.pendingToken;
    assert([401,403].includes((await request('/api/member/me',null,pendingToken)).status));
    const pending=await request('/api/auth/google/pending',{pendingToken});assert.equal(pending.status,200);
    assert.deepEqual(pending.body.accounts.map(row=>row.id).sort(),[first.id,second.id].sort());
    assert(!JSON.stringify(pending.body).includes('password'));
    for(const accountId of [unrelated.id,blocked.id,unconfirmed.id,999999])assert.equal((await request('/api/auth/google/link',{pendingToken,accountId,password})).status,400);
    assert.equal((await request('/api/auth/google/link',{pendingToken,accountId:first.id,password:'wrong'})).status,400);
    assert.equal((await request('/api/auth/google/link',{pendingToken,accountId:first.id,password,role:contributor.id})).status,400);
    const secret=createHmac('sha256',app.config.get('plugin::users-permissions.jwtSecret')).update('vertical-cotiere:google-link').digest();
    const expired=await new SignJWT({email:sharedEmail}).setProtectedHeader({alg:'HS256'}).setIssuer('vertical-cotiere').setAudience('member-google-link').setSubject('family-google-subject').setIssuedAt().setExpirationTime(1).sign(secret);
    for(const value of [pendingToken+'x',expired])assert.equal((await request('/api/auth/google/link',{pendingToken:value,accountId:first.id,password})).status,400);
    const linked=await request('/api/auth/google/link',{pendingToken,accountId:first.id,password});assert.equal(linked.status,200,JSON.stringify(linked.body));
    const linkedProfile=(await request('/api/member/me',null,linked.body.jwt)).body;
    assert.equal(linkedProfile.id,first.id);assert.equal(linkedProfile.role,'contributor');assert.equal(linkedProfile.ffmeLicenseNumber,'123456');assert.equal(linkedProfile.hasPassword,true);
    assert.equal((await request('/api/auth/local',{identifier:first.username,password})).status,200);
    assert.equal((await request('/api/auth/google/link',{pendingToken,accountId:second.id,password})).status,400);
    assert(!(await query.findOne({where:{id:second.id}})).googleSubject);
    const familyLogin=await callback({sub:'family-google-subject',email:sharedEmail});assert.equal((await request('/api/member/me',null,familyLogin.body.jwt)).body.id,first.id);
    const concurrentPending=(await callback({sub:'concurrent-subject',email:sharedEmail})).body.pendingToken;
    const concurrent=await Promise.all([1,2].map(()=>request('/api/auth/google/link',{pendingToken:concurrentPending,accountId:second.id,password})));
    assert.deepEqual(concurrent.map(row=>row.status).sort(),[200,400]);
    assert.equal((await request('/api/auth/local/register',{username:'google-forge',email:'forge@local.invalid',password,googleSubject:'family-google-subject'})).status,400);
    assert.equal((await request('/api/member/profile',{googleSubject:'forged'},linked.body.jwt,'PUT')).status,400);
    assert.equal((await request('/api/auth/google/callback?access_token=forged')).status,400);
    await app.store(auth).set({value:{...advanced,allow_register:false}});assert.equal((await callback({sub:'registration-disabled',email:'disabled@local.invalid'})).status,400);
    console.log('OK Google : signature, audience, émetteur, nonce, expiration, e-mail vérifié, PKCE, profil basique, identité stable, blocage, liaison explicite, adresses partagées, rôle et mot de passe conservés, jeton expiré/falsifié, concurrence et protection des champs.');
  }finally {
    global.fetch=originalFetch;https.get=originalGet;await app.store(auth).set({value:advanced});
    for(const [key,value] of Object.entries(previousEnv))if(value===undefined)delete process.env[key];else process.env[key]=value;
  }
};
