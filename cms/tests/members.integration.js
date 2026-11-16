// Real Strapi API on a disposable database; Mistral is always mocked.
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');const {Client}=require('pg');const fs=require('node:fs/promises');
if(process.env.RUN_MEMBER_TESTS!=='true'||process.env.MISTRAL_API_KEY!=='mistral-test-key')throw Error('Recette membre isolée et clé factice requises.');
process.env.RUN_ASSISTANT_TESTS='true';require('./mock-mistral.cjs');
// Intercept delivery in this isolated recipe; never use real mailbox credentials.
process.env.SMTP_HOST='smtp.member-test.invalid';process.env.SMTP_USER='expediteur@local.invalid';process.env.SMTP_PASSWORD='smtp-test-only';
process.env.PUBLIC_SITE_URL=process.env.MEMBER_UI_FIXTURE?'http://127.0.0.1:3107':'http://localhost:3000';
const {createStrapi}=require('@strapi/strapi');
const database='vertical_member_test_'+randomBytes(6).toString('hex');
const password=randomBytes(20).toString('hex')+'A1!';
const base='http://127.0.0.1:1347';
const connection={host:process.env.DATABASE_HOST,user:process.env.DATABASE_USERNAME,password:process.env.DATABASE_PASSWORD,database:process.env.DATABASE_NAME};
(async()=>{
  const db=new Client(connection);await db.connect();let app,created=false;const files=[];
  try {
    await db.query(`CREATE DATABASE "${database}"`);created=true;process.env.DATABASE_NAME=database;
    app=createStrapi();await app.register();
    // This disposable instance exercises many consecutive login attempts.
    app.config.set('plugin::users-permissions.ratelimit',{enabled:true,max:500});
    app.app.bootstrap=async()=>{await require('../src/lib/configure-admin')(app);await require('../src/lib/configure-members')(app);};
    app.config.set('admin.serveAdminPanel',Boolean(process.env.MEMBER_ROLE_UI_FIXTURE));app.config.set('server.port',1347);app.config.set('server.url',base);
    await app.bootstrap();app.isLoaded=true;await app.start();
    const sentEmails=[];app.plugin('email').provider.send=async email=>{sentEmails.push(email);return {accepted:[email.to]};};
    async function request(path,body,token,method=body?'POST':'GET') {
      const response=await fetch(base+path,{method,redirect:'manual',headers:{...(body instanceof FormData?{}:{'Content-Type':'application/json'}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});
      const text=await response.text();let bodyJson;try{bodyJson=JSON.parse(text);}catch{}return {status:response.status,body:bodyJson};
    }
    const users=app.plugin('users-permissions').service('user');const query=app.db.query('plugin::users-permissions.user');
    const basic=await app.db.query('plugin::users-permissions.role').findOne({where:{type:'authenticated'}});
    const contributor=await app.db.query('plugin::users-permissions.role').findOne({where:{type:'contributor'}});
    const superRole=await app.db.query('admin::role').findOne({where:{code:'strapi-super-admin'}});
    const admin=await app.service('admin::user').create({email:'member-admin@local.invalid',password,firstname:'Test',lastname:'Admin',isActive:true,roles:[superRole.id]});
    const adminLogin=await request('/admin/login',{email:admin.email,password});assert.equal(adminLogin.status,200);
    const adminCreated=await request('/content-manager/collection-types/plugin::users-permissions.user',{username:'admin-created@local.invalid',email:'admin-created@local.invalid',password,firstName:'Créé',lastName:'Par admin',role:contributor.id,confirmed:true},adminLogin.body.data.token);
    assert.equal(adminCreated.status,201,JSON.stringify(adminCreated.body));
    const adminCreatedLogin=await request('/api/auth/local',{identifier:'admin-created@local.invalid',password});assert.equal(adminCreatedLogin.status,200,JSON.stringify(adminCreatedLogin.body));
    assert.equal((await request('/api/member/me',null,adminCreatedLogin.body.jwt)).body.role,'contributor');
    const signup=await request('/api/auth/local/register',{username:'member-a@local.invalid',email:'member-a@local.invalid',password,firstName:'Camille',lastName:'Martin'});
    assert.equal(signup.status,200,JSON.stringify(signup.body));assert.equal(signup.body.requiresConfirmation,true);assert.equal(signup.body.jwt,undefined);
    const pendingMember=await query.findOne({where:{username:'member-a@local.invalid'}});
    assert.equal((await request('/api/auth/local',{identifier:pendingMember.username,password})).status,400);
    assert.equal((await request('/api/auth/email-confirmation?confirmation='+pendingMember.confirmationToken)).status,302);
    const loggedIn=await request('/api/auth/local',{identifier:pendingMember.username,password});assert.equal(loggedIn.status,200);
    const token=loggedIn.body.jwt;const user=loggedIn.body.user;sentEmails.length=0;
    assert.equal((await query.findOne({where:{id:user.id},populate:{role:true}})).role.type,'authenticated');
    await require('./member-roles.integration.cjs')({app,request,user,token,basic,contributor,admin,adminToken:adminLogin.body.data.token,password});
    await require('./member-google.integration.cjs')({app,request,basic,contributor,password});
    const other=await users.add({username:'member-b@local.invalid',email:'member-b@local.invalid',password,firstName:'Alex',lastName:'Test',role:contributor.id,confirmed:true,provider:'local'});
    const otherToken=app.plugin('users-permissions').service('jwt').issue({id:other.id});
    assert([401,403].includes((await request('/api/member/me')).status));
    assert.equal((await request('/api/member/me',null,token)).body.firstName,'Camille');
    assert.equal((await request('/api/member/profile',{street:'1 rue du Club',city:'Beynost',postalCode:'01700',country:'France',phone:'0600000000',ffmeLicenseNumber:'000123456'},token,'PUT')).status,200);
    const me=(await request('/api/member/me',null,token)).body;
    assert.equal(me.ffmeLicenseNumber,'000123456');assert.equal(me.street,'1 rue du Club');assert.equal(me.role,'basic');
    assert(!JSON.stringify(me).includes('password'));assert(!JSON.stringify(me).includes('resetPasswordToken'));
    assert.equal((await request('/api/member/profile',{role:contributor.id,id:other.id},token,'PUT')).status,400);
    assert.equal((await request('/api/member/me',null,token)).body.role,'basic');
    assert([401,403].includes((await request('/api/users',null,token)).status));
    assert([401,403].includes((await request('/api/users/'+other.id,null,token)).status));
    assert([401,403].includes((await request('/api/users/'+other.id,{firstName:'Intrusion'},token,'PUT')).status));
    assert.equal((await request('/api/member/assistant/prepare',{instruction:'TEST_VALID'},token)).status,403);
    assert.equal((await request('/api/auth/local/register',{username:'escalation@local.invalid',email:'escalation@local.invalid',password,role:contributor.id})).status,400);
    assert([401,403].includes((await request('/admin/users/me',null,token)).status));
    // Promotion simulates the administrator's account-management action.
    await users.edit(user.id,{role:contributor.id});
    assert.equal((await request('/api/member/me',null,token)).body.role,'contributor');
    const image=await require('sharp')({create:{width:30,height:20,channels:3,background:'#446a55'}}).png().toBuffer();
    const form=new FormData();form.append('files',new Blob([image],{type:'image/png'}),'member-test.png');
    const upload=await request('/api/member/photos',form,token);assert.equal(upload.status,200,JSON.stringify(upload.body));files.push(...upload.body);
    assert.equal((await request('/api/member/photos/'+upload.body[0].id,null,token)).status,200);
    assert.equal((await request('/api/member/photos/'+upload.body[0].id,null,otherToken)).status,403);
    const alien=await request('/api/member/assistant/prepare',{instruction:'TEST_VALID',photos:[upload.body[0].id]},otherToken);assert.equal(alien.status,403);
    const prepare=await request('/api/member/assistant/prepare',{instruction:'TEST_VALID',photos:[upload.body[0].id]},token);
    assert.equal(prepare.status,200,JSON.stringify(prepare.body));assert.equal(prepare.body.canPublish,true);
    const confirmed=await request('/api/member/assistant/confirm',{previewId:prepare.body.previewId,mode:'publish'},token);
    assert.equal(confirmed.status,200,JSON.stringify(confirmed.body));const documentId=confirmed.body.documentId;
    const docs=app.documents('api::publication.publication');
    const publication=await docs.findOne({documentId,status:'published',populate:{memberAuthor:true,photos:true,meeting:true}});
    assert.equal(publication.memberAuthor.id,user.id);assert.equal(publication.photos[0].id,upload.body[0].id);
    assert.equal(publication.createdBy,undefined);
    const listed=(await request('/api/member/publications',null,token)).body.find(row=>row.documentId===documentId);
    assert.equal(listed.body,publication.body);assert.equal(listed.category,publication.category);
    assert.equal(listed.url,'/vie-du-club/'+publication.slug);assert.equal(listed.published,true);
    const unpublished=await docs.create({data:{title:'Brouillon privé',body:'Contenu privé',category:'Vie du club',memberAuthor:user.id}});
    const draftListed=(await request('/api/member/publications',null,token)).body.find(row=>row.documentId===unpublished.documentId);
    assert.equal(draftListed.body,'Contenu privé');assert.equal(draftListed.url,null);assert.equal(draftListed.published,false);
    const pollFixture=await require('./participation-polls.integration.cjs')({app,request,user,token,other,otherToken,basic,contributor,docs,unpublished});
    const directoryAdmin=await require('./member-directory.integration.cjs')({app,request,user,token,basic,contributor,password});
    const photoForm=(name='community.png',bytes=image)=>{const body=new FormData();body.append('files',new Blob([bytes],{type:'image/png'}),name);return body;};
    const photoPath='/api/member/publications/'+publication.slug+'/photos';
    assert([401,403].includes((await request(photoPath,photoForm())).status));
    await users.edit(other.id,{role:basic.id});
    assert.equal((await request(photoPath,photoForm(),otherToken)).status,403);
    await users.edit(other.id,{role:contributor.id,blocked:true});
    assert([401,403].includes((await request(photoPath,photoForm(),otherToken)).status));
    await users.edit(other.id,{blocked:false});
    assert.equal((await request('/api/member/publications/'+unpublished.slug+'/photos',photoForm(),otherToken)).status,404);
    assert.equal((await request('/api/member/publications/introuvable/photos',photoForm(),otherToken)).status,404);
    assert.equal((await request(photoPath,photoForm('invalid.png',Buffer.from('not an image')),otherToken)).status,400);
    assert.equal((await request(photoPath,{photos:[upload.body[0].id]},otherToken)).status,400);
    await docs.update({documentId,data:{body:'Un texte encore en brouillon, à ne pas publier.'}});
    const draftBefore=await docs.findOne({documentId,populate:{photos:true,meeting:true}});
    const publishedBefore=await docs.findOne({documentId,status:'published',populate:{photos:true,meeting:true}});
    // Two contributors can add photos without replacing each other's files or publishing the saved draft.
    const additions=await Promise.all([
      request(photoPath,photoForm('alex.png'),otherToken),
      request(photoPath,photoForm('camille.png'),token),
    ]);
    for(const addition of additions){assert.equal(addition.status,200,JSON.stringify(addition.body));files.push(...addition.body);}
    assert.deepEqual(await docs.findOne({documentId,populate:{photos:true,meeting:true}}),draftBefore);
    assert.deepEqual(await docs.findOne({documentId,status:'published',populate:{photos:true,meeting:true}}),publishedBefore);
    const publicPhotos=(await request('/api/publications/'+publication.slug)).body;
    assert.equal(publicPhotos.body,publication.body);assert.equal(publicPhotos.photos.length,3);assert.equal(publicPhotos.photoCount,3);
    assert.equal(publicPhotos.photos.find(photo=>photo.id===additions[0].body[0].id).addedBy,'Alex Test');
    assert.equal(publicPhotos.photos.find(photo=>photo.id===additions[1].body[0].id).addedBy,'Camille Martin');
    assert(!JSON.stringify(publicPhotos).includes('member-b@local.invalid'));assert(!JSON.stringify(publicPhotos).includes('000123456'));
    assert.equal((await request('/api/site-files/'+additions[0].body[0].id)).status,200);
    assert.equal((await request('/api/site-content')).body.publications.find(row=>row.slug===publication.slug).photoCount,3);
    await docs.update({documentId,data:{body:publication.body}});
    // A publication without a member author or an initial gallery accepts community photos too.
    const historical=await docs.create({data:{title:'Publication du club',body:'Une publication créée dans Strapi.',category:'Vie du club'},status:'published'});
    const historicalAddition=await request('/api/member/publications/'+historical.slug+'/photos',photoForm(),otherToken);
    assert.equal(historicalAddition.status,200,JSON.stringify(historicalAddition.body));files.push(...historicalAddition.body);
    assert.equal((await request('/api/publications/'+historical.slug)).body.photos[0].addedBy,'Alex Test');
    // Reusing the uploaded file in editorial media must not duplicate it or remove its attribution.
    await docs.update({documentId:historical.documentId,status:'published',data:{photos:[historicalAddition.body[0].id]}});
    const reused=(await request('/api/publications/'+historical.slug)).body.photos;
    assert.equal(reused.length,1);assert.equal(reused[0].addedBy,'Alex Test');
    await docs.unpublish({documentId:historical.documentId});
    assert.equal((await request('/api/site-files/'+historicalAddition.body[0].id)).status,404);
    await docs.publish({documentId:historical.documentId});
    assert.equal((await request('/api/publications/'+historical.slug)).body.photos.length,1);
    const ownIds=await request(photoPath,null,token);
    assert.equal(ownIds.status,200);assert.deepEqual(ownIds.body.ids,[additions[1].body[0].id]);
    const deletionUpload=await request('/api/member/publications/'+historical.slug+'/photos',photoForm('to-delete.png'),otherToken);
    assert.equal(deletionUpload.status,200,JSON.stringify(deletionUpload.body));files.push(...deletionUpload.body);
    const deletionId=deletionUpload.body[0].id;
    const deletePath='/api/member/publications/'+historical.slug+'/photos/'+deletionId;
    assert([401,403].includes((await request(deletePath,null,null,'DELETE')).status));
    assert.equal((await request(deletePath,null,token,'DELETE')).status,404);
    assert.equal((await request(photoPath+'/'+deletionId,null,otherToken,'DELETE')).status,404);
    // Community deletion cannot be used to remove an editorial photo, even by its uploader.
    assert.equal((await request(photoPath+'/'+upload.body[0].id,null,token,'DELETE')).status,404);
    await users.edit(other.id,{blocked:true});
    assert([401,403].includes((await request(deletePath,null,otherToken,'DELETE')).status));
    // A member retains control of their own contributions after losing contributor status.
    await users.edit(other.id,{blocked:false,role:basic.id});
    assert((await request('/api/member/publications/'+historical.slug+'/photos',null,otherToken)).body.ids.includes(deletionId));
    assert.equal((await request(deletePath,null,otherToken,'DELETE')).status,200);
    assert.equal((await request(deletePath,null,otherToken,'DELETE')).status,404);
    assert.equal(await app.db.query('plugin::upload.file').findOne({where:{id:deletionId}}),null);
    assert.equal((await request('/api/site-files/'+deletionId)).status,404);
    assert.equal((await request('/api/publications/'+historical.slug)).body.photos.length,1);
    assert(!(await request('/api/member/publications/'+historical.slug+'/photos',null,otherToken)).body.ids.includes(deletionId));
    await users.edit(other.id,{role:contributor.id});
    const unlinked=await request('/api/member/photos',photoForm('private.png'),otherToken);assert.equal(unlinked.status,200);files.push(...unlinked.body);
    assert.equal((await request('/api/site-files/'+unlinked.body[0].id)).status,404);
    const path='/api/member/assistant/publications/'+documentId;
    const source=await request(path,null,token);assert.equal(source.status,200,JSON.stringify(source.body));
    assert.equal((await request(path,null,otherToken)).status,403);
    assert.equal((await request('/api/member/assistant/prepare',{documentId,version:source.body.version,instruction:'TEST_EDIT'},otherToken)).status,403);
    assert.equal((await request('/api/member/publications',null,otherToken)).body.length,0);
    const edit=await request('/api/member/assistant/prepare',{documentId,version:source.body.version,instruction:'TEST_EDIT'},token);assert.equal(edit.status,200,JSON.stringify(edit.body));
    assert.equal((await request('/api/member/assistant/confirm',{previewId:edit.body.previewId,mode:'publish'},otherToken)).status,410);
    const updated=await request('/api/member/assistant/confirm',{previewId:edit.body.previewId,mode:'publish'},token);assert.equal(updated.status,200,JSON.stringify(updated.body));
    assert.equal((await docs.findOne({documentId,status:'published'})).eventDate,'2027-05-23T07:00:00.000Z');
    assert.equal((await request('/api/publications/'+publication.slug)).body.photos.length,3);
    const current=await request(path,null,token);
    const pending=await request('/api/member/assistant/prepare',{documentId,version:current.body.version,instruction:'TEST_EDIT'},token);assert.equal(pending.status,200);
    await users.edit(user.id,{role:basic.id});
    assert.equal((await request('/api/member/assistant/confirm',{previewId:pending.body.previewId,mode:'publish'},token)).status,403);
    await users.edit(user.id,{role:contributor.id});
    const passwordChange=await request('/api/member/password',{currentPassword:password,password:password+'new',passwordConfirmation:password+'new'},token);
    assert.equal(passwordChange.status,200,JSON.stringify(passwordChange.body));
    const login=await request('/api/auth/local',{identifier:user.email,password:password+'new'});assert.equal(login.status,200);
    const forgot=await request('/api/auth/forgot-password',{email:user.email});assert.equal(forgot.status,200,JSON.stringify(forgot.body));
    assert.equal(sentEmails.length,1);assert.equal(sentEmails[0].to,user.email);assert.match(sentEmails[0].subject,/Vertical Côtière/);
    const emailLink=()=>new URL(sentEmails.at(-1).html.match(/href="([^"]+)"/)[1]);
    assert.equal(emailLink().origin,process.env.PUBLIC_SITE_URL);assert.equal(emailLink().pathname,'/reinitialiser-mot-de-passe');
    const firstCode=emailLink().searchParams.get('code');assert.match(firstCode,/^[a-f0-9]{128}$/);
    const expiry=(await query.findOne({where:{id:user.id}})).resetPasswordExpiresAt;
    assert(new Date(expiry).getTime()>Date.now());assert(new Date(expiry).getTime()<=Date.now()+3600000);
    const absent=await request('/api/auth/forgot-password',{email:'unknown@local.invalid'});assert.equal(absent.status,200);assert.deepEqual(absent.body,forgot.body);assert.equal(sentEmails.length,1);
    const reset=(code)=>request('/api/auth/reset-password',{code,password:password+'reset',passwordConfirmation:password+'reset'});
    assert.equal((await reset('0'.repeat(128))).status,400);
    await query.update({where:{id:user.id},data:{resetPasswordExpiresAt:new Date(Date.now()-1000).toISOString()}});
    assert.equal((await reset(firstCode)).status,400);
    await request('/api/auth/forgot-password',{email:user.email});const currentCode=emailLink().searchParams.get('code');
    assert.notEqual(currentCode,firstCode);assert.equal((await reset(firstCode)).status,400);
    await users.edit(user.id,{blocked:true});assert.equal((await reset(currentCode)).status,400);
    await users.edit(user.id,{blocked:false});assert.equal((await reset(currentCode)).status,200);
    assert.equal((await reset(currentCode)).status,400);
    assert.equal((await query.findOne({where:{id:user.id}})).resetPasswordExpiresAt,null);
    assert.equal((await request('/api/auth/local',{identifier:user.email,password:password+'new'})).status,400);
    assert.equal((await request('/api/auth/local',{identifier:user.email,password:password+'reset'})).status,200);
    await users.edit(user.id,{blocked:true});assert([401,403].includes((await request('/api/member/me',null,token)).status));
    await users.edit(user.id,{blocked:false});
    const anonymous=await request('/api/site-content');
    assert(!JSON.stringify(anonymous.body).includes('000123456'));assert(!JSON.stringify(anonymous.body).includes('member-a@local.invalid'));
    console.log('OK : comptes et profils privés, rôles, publications personnelles avec contenu et lien, photos communautaires attribuées (concurrence, brouillons conservés, dépublication, suppression réservée à leur propriétaire), blocage, changement de mot de passe et récupération par e-mail.');
    const sharedEmail=await require('./shared-email.integration.cjs')({app,request,password,adminToken:adminLogin.body.data.token,basic,sentEmails});
    if(process.env.MEMBER_UI_FIXTURE) {
      const fixture=process.env.MEMBER_UI_FIXTURE;assert.match(fixture,/^\/tmp\/member-ui-[a-z0-9-]+\.json$/);
      await request('/api/auth/forgot-password',{email:user.email});const resetCode=emailLink().searchParams.get('code');
      await fs.rm(fixture+'.done',{force:true});
      await fs.writeFile(fixture,JSON.stringify({email:user.email,password:password+'reset',resetCode,documentId,...pollFixture,directoryAdmin,sharedEmail,communitySlug:historical.slug,userId:user.id,basicId:basic.id,contributorId:contributor.id,photoBase64:image.toString('base64')}),{mode:0o600});
      console.log('Recette navigateur membre prête.');
      try{for(let i=0;i<300;i++){try{await fs.access(fixture+'.done');break;}catch{}await new Promise(resolve=>setTimeout(resolve,1000));}}
      finally{await fs.rm(fixture,{force:true});await fs.rm(fixture+'.done',{force:true});}
    }
  } finally {
    if(app){
      try{const owned=await app.db.query('api::member-upload.member-upload').findMany({populate:{file:true}});files.push(...owned.map(row=>row.file).filter(Boolean));}catch{}
      for(const file of new Map(files.map(file=>[file.id,file])).values())await app.plugin('upload').service('upload').remove(file).catch(()=>{});
      await app.destroy();
    }
    if(created)await db.query(`DROP DATABASE "${database}" WITH (FORCE)`);await db.end();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
