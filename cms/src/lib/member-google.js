const {randomBytes,createHmac}=require('node:crypto');
const {createRemoteJWKSet,jwtVerify,SignJWT}=require('jose');
const {errors}=require('@strapi/utils');
const uid='plugin::users-permissions.user';
const keys=createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'),{timeoutDuration:8000});
const invalid=()=>new errors.ValidationError('Connexion Google impossible. Recommencez la connexion ou utilisez votre mot de passe.');

function configuration() {
  const clientId=process.env.GOOGLE_CLIENT_ID;const clientSecret=process.env.GOOGLE_CLIENT_SECRET;
  let site;try{site=new URL(process.env.PUBLIC_SITE_URL);}catch{return null;}
  if(!clientId||!clientSecret||site.username||site.password||!['https:','http:'].includes(site.protocol)||site.pathname!=='/'||site.search||site.hash)return null;
  if(site.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(site.hostname))return null;
  return {clientId,clientSecret,redirectUri:site.origin+'/api/member/google/callback'};
}
function configured(ctx) {const config=configuration();if(!config)ctx.throw(503,'La connexion Google n’est pas encore configurée.');return config;}
function body(ctx,allowed) {
  ctx.set('Cache-Control','private, no-store');
  const data=ctx.request.body;
  if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!allowed.includes(key)))throw invalid();
  return data;
}
const random=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{43,128}$/.test(value);
const linkKey=app=>createHmac('sha256',app.config.get('plugin::users-permissions.jwtSecret')).update('vertical-cotiere:google-link').digest();
async function readPending(app,token) {
  try {
    if(typeof token!=='string'||token.length>4096)throw invalid();
    const {payload}=await jwtVerify(token,linkKey(app),{algorithms:['HS256'],issuer:'vertical-cotiere',audience:'member-google-link',maxTokenAge:'10m',requiredClaims:['exp','iat','sub','email']});
    if(typeof payload.sub!=='string'||typeof payload.email!=='string')throw invalid();
    return payload;
  }catch{throw invalid();}
}
const account=({id,username,firstName,lastName})=>({id,username,firstName:firstName||'',lastName:lastName||''});
const allowed=user=>user&&!user.blocked&&user.confirmed&&['authenticated','contributor'].includes(user.role?.type);
const session=(app,user)=>({jwt:app.plugin('users-permissions').service('jwt').issue({id:user.id})});
async function lockSubject(trx,subject){await trx.raw('SELECT pg_advisory_xact_lock(2672029, hashtext(?))',[subject]);}

async function verifyIdentity(token,{clientId,nonce},keySet=keys) {
  try {
    const {payload}=await jwtVerify(token,keySet,{algorithms:['RS256'],issuer:['https://accounts.google.com','accounts.google.com'],audience:clientId,maxTokenAge:'10m',requiredClaims:['exp','iat','sub','nonce','email','email_verified']});
    if(payload.nonce!==nonce||typeof payload.sub!=='string'||!payload.sub||payload.sub.length>255||payload.email_verified!==true||typeof payload.email!=='string'||payload.email.length>254||!/^\S+@\S+\.\S+$/.test(payload.email)||payload.azp&&payload.azp!==clientId)throw invalid();
    return payload;
  }catch{throw invalid();}
}
async function start(app,ctx) {
  const config=configured(ctx);const data=body(ctx,['state','nonce','codeChallenge']);
  if(!random(data.state)||!random(data.nonce)||!random(data.codeChallenge))throw invalid();
  const url=new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.redirectUri,response_type:'code',scope:'openid email profile',state:data.state,nonce:data.nonce,code_challenge:data.codeChallenge,code_challenge_method:'S256',prompt:'select_account'}).toString();
  ctx.body={url:url.href};
}
async function callback(app,ctx) {
  const config=configured(ctx);const data=body(ctx,['code','codeVerifier','nonce']);
  if(typeof data.code!=='string'||!data.code||data.code.length>4096||!random(data.codeVerifier)||!random(data.nonce))throw invalid();
  let response;
  try{response=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({code:data.code,code_verifier:data.codeVerifier,client_id:config.clientId,client_secret:config.clientSecret,redirect_uri:config.redirectUri,grant_type:'authorization_code'}),signal:AbortSignal.timeout(10000),redirect:'error'});}catch{ctx.throw(503,'Google est momentanément indisponible.');}
  if(!response.ok)throw invalid();
  const tokens=await response.json();
  const identity=await verifyIdentity(tokens.id_token,{clientId:config.clientId,nonce:data.nonce});
  const email=identity.email.trim().toLowerCase();
  await app.db.transaction(async({trx})=>{
    await lockSubject(trx,identity.sub);
    const users=app.db.query(uid);
    let user=await users.findOne({where:{googleSubject:identity.sub},populate:{role:true}});
    if(user){if(!allowed(user))throw invalid();ctx.body=session(app,user);return;}
    const existing=await users.findMany({where:{email:{$eqi:email}}});
    if(existing.length) {
      const pendingToken=await new SignJWT({email}).setProtectedHeader({alg:'HS256'}).setIssuer('vertical-cotiere').setAudience('member-google-link').setSubject(identity.sub).setIssuedAt().setExpirationTime('10m').sign(linkKey(app));
      ctx.body={requiresLink:true,pendingToken};return;
    }
    const settings=await app.store({type:'plugin',name:'users-permissions',key:'advanced'}).get();
    if(!settings.allow_register)throw invalid();
    // Never derive privileges from Google claims or the configurable default role.
    const role=await app.db.query('plugin::users-permissions.role').findOne({where:{type:'authenticated'}});
    if(!role)throw new errors.ApplicationError('Rôle membre introuvable.');
    const name=value=>typeof value==='string'?value.trim().slice(0,80):'';
    user=await app.plugin('users-permissions').service('user').add({username:'google.'+randomBytes(16).toString('hex'),email,provider:'local',googleSubject:identity.sub,confirmed:true,blocked:false,role:role.id,firstName:name(identity.given_name),lastName:name(identity.family_name)});
    ctx.body=session(app,user);
  });
}
async function pending(app,ctx) {
  configured(ctx);const {pendingToken}=body(ctx,['pendingToken']);const identity=await readPending(app,pendingToken);
  const users=await app.db.query(uid).findMany({where:{provider:'local',email:{$eqi:identity.email}},populate:{role:true},orderBy:{username:'asc'}});
  ctx.body={email:identity.email,accounts:users.filter(user=>allowed(user)&&!user.googleSubject&&user.password).map(account)};
}
async function link(app,ctx) {
  configured(ctx);const data=body(ctx,['pendingToken','accountId','password']);
  if(!Number.isSafeInteger(data.accountId)||data.accountId<1||typeof data.password!=='string'||!data.password||data.password.length>256)throw invalid();
  const identity=await readPending(app,data.pendingToken);
  await app.db.transaction(async({trx})=>{
    await lockSubject(trx,identity.sub);
    const metadata=app.db.metadata.get(uid);await trx(metadata.tableName).where({id:data.accountId}).forUpdate();
    const users=app.db.query(uid);const user=await users.findOne({where:{id:data.accountId},populate:{role:true}});
    if(!allowed(user)||user.provider!=='local'||user.googleSubject||user.email.toLowerCase()!==identity.email||!user.password||await users.findOne({where:{googleSubject:identity.sub}}))throw invalid();
    if(!await app.plugin('users-permissions').service('user').validatePassword(data.password,user.password))throw invalid();
    await users.update({where:{id:user.id},data:{googleSubject:identity.sub}});
    ctx.body=session(app,user);
  });
}
module.exports={configuration,start,callback,pending,link,verifyIdentity};
