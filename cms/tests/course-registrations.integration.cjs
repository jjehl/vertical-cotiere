// Real Strapi/PostgreSQL on a disposable database. Payments and all e-mails are mocked.
const assert=require('node:assert/strict');
const {randomBytes,createHash}=require('node:crypto');
const {Client}=require('pg');
if(process.env.RUN_REGISTRATION_TESTS!=='true')throw Error('RUN_REGISTRATION_TESTS=true requis. Cette recette utilise une base jetable.');
Object.assign(process.env,{HELLOASSO_CLIENT_ID:'registration-test-client',HELLOASSO_CLIENT_SECRET:'registration-test-secret',HELLOASSO_SANDBOX:'true',HELLOASSO_WEBHOOK_TOKEN:'registration-test-webhook',PUBLIC_SITE_URL:'https://registration-test.invalid'});
const originalFetch=global.fetch;
const intents=new Map();let serial=1000,tokenCalls=0,createCalls=0,mode='normal',lastPayload;
global.fetch=async(url,options)=>{
  if(!String(url).startsWith('https://api.helloasso-sandbox.com'))return originalFetch(url,options);
  if(String(url).endsWith('/oauth2/token')){tokenCalls++;return Response.json({access_token:'test-token',refresh_token:'test-refresh',expires_in:1800});}
  if(options.method==='POST'){
    createCalls++;lastPayload=JSON.parse(options.body);
    if(mode==='timeout')throw new Error('Mock timeout');
    if(mode==='rejected')return Response.json({}, {status:400});
    const id=++serial;intents.set(String(id),{id,metadata:lastPayload.metadata,order:null});
    return Response.json({id,redirectUrl:'https://www.helloasso-sandbox.com/checkout/'+id});
  }
  const intent=intents.get(String(url).split('/').pop());return Response.json(intent||{});
};
const {createStrapi}=require('@strapi/strapi');
const database='vertical_registration_test_'+randomBytes(6).toString('hex');
const connection={host:process.env.DATABASE_HOST,user:process.env.DATABASE_USERNAME,password:process.env.DATABASE_PASSWORD,database:process.env.DATABASE_NAME};
(async()=>{
  const db=new Client(connection);await db.connect();let app,created=false;
  try {
    await db.query(`CREATE DATABASE "${database}"`);created=true;process.env.DATABASE_NAME=database;
    app=createStrapi();await app.register();app.app.bootstrap=async()=>{await require('../src/lib/configure-members')(app);};
    app.config.set('admin.serveAdminPanel',false);app.config.set('server.port',1348);app.config.set('server.url','http://127.0.0.1:1348');
    await app.bootstrap();app.isLoaded=true;await app.start();
    const sent=[];let mailFails=false;
    app.plugin('email').provider.send=async email=>{if(mailFails)throw new Error('Mock SMTP unavailable');sent.push(email);return {accepted:[email.to]};};
    const request=async(path,body,token)=>{const r=await originalFetch('http://127.0.0.1:1348'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});let data;try{data=await r.json();}catch{}return {status:r.status,body:data};};
    const api=(path,body,token)=>request('/api/registrations'+path,body,token);
    const users=app.db.query('plugin::users-permissions.user');const service=app.plugin('users-permissions').service('user');
    const role=await app.db.query('plugin::users-permissions.role').findOne({where:{type:'authenticated'}});
    const password='Registration-test-password-123!';
    const add=(username,firstName,confirmed=true)=>service.add({username,firstName,lastName:'Payeur',email:username+'@local.invalid',password,provider:'local',role:role.id,confirmed});
    const payer=await add('marie.payeur','Marie');const other=await add('alex.payeur','Alex');const unverified=await add('non.confirme','Non',false);
    const jwt=user=>app.plugin('users-permissions').service('jwt').issue({id:user.id});const token=jwt(payer);const otherToken=jwt(other);
    const docs=app.documents('api::club-timetable.club-timetable');
    const sessions=[{registrationCode:'course-a',label:'Cours A',day:'Lundi',start:'17:30:00.000',end:'19:00:00.000',audience:'Enfants',birthYears:'2016–2018',supervised:true,capacity:1,registrationEnabled:true,occupiedPlaces:0,priceCents:16000,ccmpPriceCents:15000,familyPriceCents:14000,ccmpFamilyPriceCents:13000},{registrationCode:'course-b',label:'Cours B',day:'Mardi',start:'19:00:00.000',end:'21:00:00.000',audience:'Adultes',supervised:true,capacity:100,registrationEnabled:true,occupiedPlaces:1,priceCents:16000,ccmpPriceCents:15000,familyPriceCents:14000,ccmpFamilyPriceCents:13000}];
    const timetable=await docs.create({status:'published',data:{season:'2026–2027',registrationsOpen:true,registrationOpensAt:'2026-05-27T22:00:00.000Z',sessions,ufraps:{opens:'2026-09-01',closes:'2027-06-30',day:'Samedi',start:'10:00:00.000',end:'12:00:00.000'}}});
    await require('../src/lib/configure-registrations')(app);
    const input=(firstName='Camille')=>({participantMode:'other',slotCode:'course-a',firstName,lastName:'Martin',birthDate:'2017-02-12',email:firstName.toLowerCase()+'@local.invalid',address:'1 rue du Gymnase, 01700 Beynost',promoCode:'STANDARD',accepted:true});
    const rows=app.db.query('api::course-registration.course-registration');const reset=()=>rows.deleteMany({where:{}});
    for(const path of ['/checkout','/status']) {
      assert([401,403].includes((await api(path,input())).status));
      assert([401,403].includes((await api(path,input(),jwt(unverified))).status));
    }
    await service.edit(other.id,{blocked:true});assert.equal((await api('/checkout',input(),otherToken)).status,401);await service.edit(other.id,{blocked:false});
    assert.equal((await request('/api/member/me',null,token)).body.emailConfirmed,true);
    assert.equal((await api('')).body.sessions[1].remaining,99);
    for(const fields of [{accepted:false},{birthDate:'2017-02-31'},{birthDate:'2011-01-01'},{promoCode:'FAM'},{payer:other.id},{payerEmail:other.email},{amountCents:1}])assert.equal((await api('/checkout',{...input(),...fields},token)).status,400);
    const before=await users.count({});
    const race=await Promise.all([api('/checkout',input(),token),api('/checkout',input('Nina'),otherToken)]);
    assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);assert.equal(await rows.count({}),1);assert.equal(createCalls,1);
    const saved=await rows.findOne({populate:{payer:true}});const owner=saved.payer.id===payer.id?payer:other;const ownerToken=jwt(owner);const person=input(saved.firstName);
    assert.deepEqual(lastPayload.payer,{firstName:owner.firstName,lastName:owner.lastName,email:owner.email});assert.notEqual(lastPayload.payer.email,saved.email);assert.equal(lastPayload.totalAmount,16000);
    assert.equal(await users.count({}),before,'No account before successful payment');
    assert.equal((await api('/checkout',person,ownerToken)).body.reference,saved.reference);assert.equal(createCalls,1);
    assert.equal((await api('/checkout',person,owner.id===payer.id?otherToken:token)).status,409);
    assert.deepEqual((await api('/status',{},owner.id===payer.id?otherToken:token)).body.registrations,[]);
    assert.equal((await api('/status?code=succeeded',{},ownerToken)).body.registrations[0].status,'pending');
    const remote=intents.get(saved.checkoutIntentId);remote.order={payments:[{state:'Authorized',amount:1,amountTip:16000}]};
    assert.equal((await api('/status',{},ownerToken)).body.registrations[0].status,'pending');
    remote.order={payments:[{state:'Authorized',amount:16000,amountTip:2500}]};
    assert.equal((await api('/helloasso',{metadata:{registrationReference:saved.reference}})).status,403);
    const notify=()=>api('/helloasso?key=registration-test-webhook',{eventType:'Order',metadata:{registrationReference:saved.reference}});
    const notifications=await Promise.all([notify(),notify(),api('/status',{},ownerToken)]);assert(notifications.every(r=>r.status===200));
    const registered=await rows.findOne({where:{id:saved.id},populate:{member:true}});assert.equal(registered.registrationStatus,'confirmed');assert(registered.member);assert.equal(registered.member.confirmed,false);assert.equal(await users.count({}),before+1);assert.equal(sent.length,1);
    assert.equal(registered.member.email,saved.email);assert.notEqual(registered.member.id,owner.id);assert.equal((await service.fetch(registered.member.id,{populate:['role']})).role.type,'authenticated');
    const invitation=sent[0];assert.equal(invitation.to,saved.email);assert(invitation.html.includes(registered.member.username));
    const code=new URL(invitation.html.match(/href="([^"]+)"/)[1]).searchParams.get('code');assert.match(code,/^[a-f0-9]{64}$/);assert.notEqual(registered.member.registrationInviteToken,code);assert.equal(registered.member.registrationInviteToken,createHash('sha256').update(code).digest('hex'));
    const activate={code,password,passwordConfirmation:password};
    assert.equal((await api('/activate',{...activate,password:'short'})).status,400);
    const activated=await Promise.all([api('/activate',activate),api('/activate',activate)]);assert.deepEqual(activated.map(r=>r.status).sort(),[200,400]);
    const activeMember=await users.findOne({where:{id:registered.member.id}});assert.equal(activeMember.confirmed,true);assert.equal(activeMember.registrationInviteToken,null);assert(await service.validatePassword(password,activeMember.password));
    const login=await request('/api/auth/local',{identifier:activeMember.username,password});assert.equal(login.status,200,JSON.stringify(login));
    const status=(await api('/status',{},ownerToken)).body;assert(!JSON.stringify(status).includes(code));assert(!JSON.stringify(status).includes('password'));assert.equal(status.registrations[0].email,saved.email);
    await notify();assert.equal(sent.length,1);assert.equal(await users.count({}),before+1);
    // Self signup always uses the authenticated profile, even if its fields are forged.
    await reset();const own=await api('/checkout',{...input(),participantMode:'self',slotCode:'course-b',firstName:'Faux',lastName:'Autre',email:'fake@local.invalid',birthDate:'1985-02-01'},token);assert.equal(own.status,200,JSON.stringify(own));
    const ownRow=await rows.findOne({populate:{payer:true,member:true}});assert.equal(ownRow.member.id,payer.id);assert.equal(ownRow.payer.id,payer.id);assert.equal(ownRow.firstName,payer.firstName);assert.equal(ownRow.email,payer.email);
    // More than five simultaneous dossiers, with the same authenticated payer.
    await reset();for(let i=0;i<7;i++){const result=await api('/checkout',{...input('Enfant'+i),slotCode:'course-b'},token);assert.equal(result.status,200,JSON.stringify(result));}
    assert.equal((await api('/status',{},token)).body.registrations.length,7);assert.equal(await users.count({}),before+1);
    // An existing account is reused; it never receives another password or invitation.
    await reset();const existing=await service.add({username:'existing.child',firstName:'Déjà',lastName:'Martin',email:'family@local.invalid',password,provider:'local',role:role.id,confirmed:true});
    const existingPassword=existing.password;
    const existingResult=await api('/checkout',{...input('Déjà'),email:existing.email},token);assert.equal(existingResult.status,200);
    let row=await rows.findOne({});intents.get(row.checkoutIntentId).order={payments:[{state:'Authorized',amount:16000}]};await api('/status',{},token);
    row=await rows.findOne({populate:{member:true}});assert.equal(row.member.id,existing.id);assert.equal(row.memberCreated,false);assert.equal(row.member.password,existingPassword);assert.equal(sent.length,1);
    // Two different people may share an email and get distinct accounts.
    await reset();for(const firstName of ['Zoé','Louis']){const r=await api('/checkout',{...input(firstName),slotCode:'course-b',email:'shared@local.invalid'},token);assert.equal(r.status,200);}
    for(const row of await rows.findMany({}))intents.get(row.checkoutIntentId).order={payments:[{state:'Authorized',amount:16000}]};
    await api('/status',{},token);const shared=await users.findMany({where:{email:'shared@local.invalid'}});assert.equal(shared.length,2);assert.notEqual(shared[0].username,shared[1].username);
    // A failed email does not roll back a confirmed payment; it is retried on status refresh.
    await reset();mailFails=true;await api('/checkout',input('Invitation'),token);row=await rows.findOne({});intents.get(row.checkoutIntentId).order={payments:[{state:'Authorized',amount:16000}]};
    let tracked=(await api('/status',{},token)).body.registrations[0];assert.equal(tracked.status,'confirmed');assert.equal(tracked.invitationPending,true);
    mailFails=false;tracked=(await api('/status',{},token)).body.registrations[0];assert.equal(tracked.invitationPending,false);
    row=await rows.findOne({populate:{member:true}});const last=sent.at(-1);const expiredCode=new URL(last.html.match(/href="([^"]+)"/)[1]).searchParams.get('code');await users.update({where:{id:row.member.id},data:{registrationInviteExpiresAt:'2020-01-01T00:00:00.000Z'}});
    assert.equal((await api('/activate',{...activate,code:expiredCode})).status,400);
    for(const [promoCode,amount] of [['STANDARD',16000],['CCMP1OU2',15000],['FAM',14000],['CCMP3',13000]]){await reset();const r=await api('/checkout',{...input(),promoCode,familyReference:'Zoé et Louis Martin'},token);assert.equal(r.status,200);assert.equal(r.body.amountCents,amount);}
    assert.equal(tokenCalls,1);
    await reset();mode='rejected';assert.equal((await api('/checkout',input(),token)).status,503);assert.equal((await api('')).body.sessions[0].remaining,1);
    await reset();mode='timeout';assert.equal((await api('/checkout',input(),token)).status,503);assert.equal((await api('')).body.sessions[0].remaining,0);mode='normal';
    await docs.update({documentId:timetable.documentId,data:{registrationsOpen:false},status:'published'});assert.equal((await api('/checkout',input('Autre'),token)).status,409);
    // New ordinary accounts also require email validation before any login/registration.
    const signup=await request('/api/auth/local/register',{username:'new.payer',email:'new@local.invalid',firstName:'Nouveau',lastName:'Payeur',password});assert.equal(signup.body.requiresConfirmation,true);assert.equal(signup.body.jwt,undefined);
    assert.equal((await request('/api/auth/local',{identifier:'new.payer',password})).status,400);
    // Changing an email cannot retain its old validation.
    const response=await originalFetch('http://127.0.0.1:1348/api/member/profile',{method:'PUT',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({email:'changed@local.invalid'})});assert.equal(response.status,200);assert.equal((await response.json()).emailConfirmed,false);assert([401,403].includes((await api('/checkout',input(),token)).status));
    console.log('OK : connexion et e-mail validé obligatoires, payeur serveur, dossiers sans limite de cinq, stock concurrent, quatre tarifs, comptes après paiement, réutilisation sans modification, e-mails partagés, invitations uniques/réessayables, activation atomique/expirée, nouveaux comptes confirmés par e-mail et changement d’adresse revalidé.');
  }finally{if(app)await app.destroy();if(created)await db.query(`DROP DATABASE "${database}" WITH (FORCE)`);await db.end();global.fetch=originalFetch;}
})().catch(error=>{console.error(error);process.exitCode=1;});
