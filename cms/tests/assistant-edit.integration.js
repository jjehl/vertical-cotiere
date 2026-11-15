// Creates and drops its own database. Never writes to the club's database and
// never calls Mistral: the fake key and explicit mock are required.
const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {Client}=require('pg');
if(process.env.RUN_ASSISTANT_TESTS!=='true'||process.env.MISTRAL_API_KEY!=='mistral-test-key')throw Error('Recette isolée et clé factice requises.');
require('./mock-mistral.cjs');
const {createStrapi}=require('@strapi/strapi');
const uid='api::publication.publication';
const database='vertical_edit_test_'+randomBytes(6).toString('hex');
const password=randomBytes(24).toString('base64url')+'aA1!';
const base='http://127.0.0.1:'+(process.env.PORT||1347);
const connection={host:process.env.DATABASE_HOST,user:process.env.DATABASE_USERNAME,password:process.env.DATABASE_PASSWORD,database:process.env.DATABASE_NAME};
(async()=>{
  const db=new Client(connection);await db.connect();
  let app,created=false;
  try {
    await db.query(`CREATE DATABASE "${database}"`);created=true;
    process.env.DATABASE_NAME=database;
    app=createStrapi();
    await app.register();
    // Keep the real middleware and plugins, skip importing club content/media.
    app.app.bootstrap=async()=>require('../src/lib/configure-admin')(app);
    app.config.set('admin.serveAdminPanel',false);
    app.config.set('server.port',Number(process.env.PORT||1347));
    app.config.set('server.url',base);
    await app.bootstrap();app.isLoaded=true;await app.start();
    const docs=app.documents(uid);
    const superRole=await app.db.query('admin::role').findOne({where:{code:'strapi-super-admin'}});
    const user=await app.service('admin::user').create({email:'edit-test@local.invalid',password,firstname:'Test',lastname:'IA',isActive:true,roles:[superRole.id]});
    async function request(path,body,token) {
      const response=await fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
      return {status:response.status,body:await response.json()};
    }
    const login=await request('/admin/login',{email:user.email,password});assert.equal(login.status,200);
    const token=login.body.data.token;
    const file=await app.db.query('plugin::upload.file').create({data:{name:'Photo existante',hash:'edit-test',ext:'.jpg',mime:'image/jpeg',size:1,url:'/uploads/edit-test.jpg',provider:'local'}});
    const doc=await docs.create({data:{title:'Sortie initiale',body:'Prévoir un pique-nique.',category:'Sortie',photos:[file.id],attachments:[file.id],coverImage:file.id,meeting:{start:'2027-05-16T07:00:00.000Z',end:'2027-05-16T15:00:00.000Z',deadline:'2027-05-15T07:00:00.000Z',location:'Vertrieu',allDay:false,eventState:'prévu',calendarUid:'stable-calendar',tags:['club']}}});
    await docs.publish({documentId:doc.documentId});
    const original=await docs.findOne({documentId:doc.documentId,status:'published',populate:{meeting:true}});
    const path='/publication-assistant/publications/'+doc.documentId;
    assert([401,403].includes((await request(path)).status));
    const source=await request(path,null,token);assert.equal(source.status,200,JSON.stringify(source.body));
    assert.equal(source.body.data.meeting.start,'2027-05-16T07:00:00.000Z');
    const before=await app.db.query(uid).count();
    async function prepare(version=source.body.version) {
      return request('/publication-assistant/prepare',{instruction:'TEST_EDIT reporte la sortie et ajoute le casque.',documentId:doc.documentId,version},token);
    }
    const proposal=await prepare();assert.equal(proposal.status,200,JSON.stringify(proposal.body));
    assert.equal(proposal.body.documentId,doc.documentId);assert(proposal.body.original);
    assert.equal(proposal.body.data.meeting.start,'2027-05-23T07:00:00.000Z');
    assert.equal(await app.db.query(uid).count(),before);
    const confirm=()=>request('/publication-assistant/confirm',{previewId:proposal.body.previewId,mode:'draft'},token);
    const saved=await confirm();assert.equal(saved.status,200,JSON.stringify(saved.body));
    assert.equal(saved.body.documentId,doc.documentId);assert.equal(saved.body.updated,true);
    const populate={meeting:true,photos:true,attachments:true,coverImage:true,createdBy:true,updatedBy:true};
    const draft=await docs.findOne({documentId:doc.documentId,populate});
    assert.equal(draft.meeting.start,'2027-05-23T07:00:00.000Z');assert.equal(draft.eventDate,draft.meeting.start);
    assert.equal(draft.meeting.deadline,null);assert.equal(draft.meeting.calendarUid,'stable-calendar');assert.deepEqual(draft.meeting.tags,['club']);
    assert.deepEqual(draft.photos.map(file=>file.id),[file.id]);assert.deepEqual(draft.attachments.map(file=>file.id),[file.id]);assert.equal(draft.coverImage.id,file.id);
    assert.equal(draft.slug,original.slug);assert.equal(draft.date,original.date);assert.equal(draft.updatedBy.id,user.id);
    assert.equal((await docs.findOne({documentId:doc.documentId,status:'published',populate})).meeting.start,original.meeting.start);
    assert.deepEqual((await confirm()).body,saved.body);assert.equal(await app.db.query(uid).count(),before);
    const fresh=await request(path,null,token);
    const toPublish=await prepare(fresh.body.version);assert.equal(toPublish.status,200,JSON.stringify(toPublish.body));
    const published=await request('/publication-assistant/confirm',{previewId:toPublish.body.previewId,mode:'publish'},token);
    assert.equal(published.status,200,JSON.stringify(published.body));
    assert.equal((await docs.findOne({documentId:doc.documentId,status:'published'})).eventDate,'2027-05-23T07:00:00.000Z');
    const latest=await request(path,null,token);
    const stale=await prepare(latest.body.version);assert.equal(stale.status,200);
    await docs.update({documentId:doc.documentId,data:{body:'Modification manuelle concurrente.'}});
    assert.equal((await request('/publication-assistant/confirm',{previewId:stale.body.previewId,mode:'publish'},token)).status,409);
    assert.equal((await docs.findOne({documentId:doc.documentId})).body,'Modification manuelle concurrente.');
    const list=await request('/content-manager/collection-types/'+uid+'?sort=eventDate:ASC',null,token);
    assert.equal(list.status,200,JSON.stringify(list.body));assert.equal(list.body.results[0].eventDate,'2027-05-23T07:00:00.000Z');
    const role=await app.service('admin::role').create({name:'Lecture seule IA',code:'edit-read-only'});
    await app.service('admin::role').assignPermissions(role.id,[{action:'plugin::publication-assistant.use',subject:null,properties:{},conditions:[]},{action:'plugin::content-manager.explorer.read',subject:uid,properties:{fields:['title','body','category','meeting','photos']},conditions:[]}]);
    const reader=await app.service('admin::user').create({email:'reader@local.invalid',password,firstname:'Test',lastname:'Reader',isActive:true,roles:[role.id]});
    const readerLogin=await request('/admin/login',{email:reader.email,password});
    assert.equal((await request(path,null,readerLogin.body.data.token)).status,403);
    assert.equal((await request('/publication-assistant/prepare',{documentId:doc.documentId,version:latest.body.version,instruction:'TEST_EDIT'},readerLogin.body.data.token)).status,403);
    const fields=['title','body','category','photos','meeting',...Object.keys(require('../src/plugins/publication-assistant/server/proposal').schema.properties.meeting.properties).map(key=>'meeting.'+key)];
    const editorRole=await app.service('admin::role').create({name:'Modification IA sans création',code:'edit-without-create'});
    await app.service('admin::role').assignPermissions(editorRole.id,[
      {action:'plugin::publication-assistant.use',subject:null,properties:{},conditions:[]},
      ...['read','update'].map(action=>({action:'plugin::content-manager.explorer.'+action,subject:uid,properties:{fields},conditions:[]})),
    ]);
    const editor=await app.service('admin::user').create({email:'editor@local.invalid',password,firstname:'Test',lastname:'Editor',isActive:true,roles:[editorRole.id]});
    const editorLogin=await request('/admin/login',{email:editor.email,password});const editorToken=editorLogin.body.data.token;
    const editable=await request(path,null,editorToken);assert.equal(editable.status,200,JSON.stringify(editable.body));
    const editOnly=await request('/publication-assistant/prepare',{documentId:doc.documentId,version:editable.body.version,instruction:'TEST_EDIT'},editorToken);
    assert.equal(editOnly.status,200,JSON.stringify(editOnly.body));assert.equal(editOnly.body.canPublish,false);
    assert.equal((await request('/publication-assistant/confirm',{previewId:editOnly.body.previewId,mode:'publish'},editorToken)).status,403);
    assert.equal((await request('/publication-assistant/confirm',{previewId:editOnly.body.previewId,mode:'draft'},editorToken)).status,200);
    assert.equal((await request('/publication-assistant/prepare',{instruction:'TEST_VALID'},editorToken)).status,403);
    const creation=await request('/publication-assistant/prepare',{instruction:'TEST_VALID'},token);assert.equal(creation.status,200,JSON.stringify(creation.body));
    const createdPublication=await request('/publication-assistant/confirm',{previewId:creation.body.previewId,mode:'draft'},token);
    assert.equal(createdPublication.status,200,JSON.stringify(createdPublication.body));assert.notEqual(createdPublication.body.documentId,doc.documentId);assert.equal(createdPublication.body.updated,false);
    const {categories}=require('../src/lib/publication-categories');
    for(const category of categories) {
      const entry=await docs.create({data:{title:'Catégorie '+category,category}});
      await docs.publish({documentId:entry.documentId});
      assert.equal((await docs.findOne({documentId:entry.documentId,status:'published'})).category,category);
    }
    await assert.rejects(docs.update({documentId:doc.documentId,data:{category:'Texte libre'}}),/category/i);
    const incomplete=await docs.create({data:{title:'Catégorie manquante',category:null}});
    await assert.rejects(docs.publish({documentId:incomplete.documentId}),/category/i);
    const legacy=await docs.create({data:{title:'Ancienne catégorie',category:'Vie du club'}});
    await docs.publish({documentId:legacy.documentId});
    const {tableName}=app.db.metadata.get(uid);
    await app.db.connection(tableName).where({document_id:legacy.documentId}).whereNull('published_at').update({category:'Compétitions, Officiel'});
    await app.db.connection(tableName).where({document_id:legacy.documentId}).whereNotNull('published_at').update({category:'Non classé'});
    const timestamps=await app.db.query(uid).findMany({where:{documentId:legacy.documentId},orderBy:{id:'asc'},select:['id','updatedAt','publishedAt']});
    await require('../src/lib/migrate-publication-categories')(app);
    assert.equal((await docs.findOne({documentId:legacy.documentId})).category,'Compétition');
    assert.equal((await docs.findOne({documentId:legacy.documentId,status:'published'})).category,'Vie du club');
    assert.deepEqual(await app.db.query(uid).findMany({where:{documentId:legacy.documentId},orderBy:{id:'asc'},select:['id','updatedAt','publishedAt']}),timestamps);
    console.log('OK : cinq catégories autorisées, champ requis à la publication, autres valeurs refusées et reprise des anciennes versions sans modification des dates.');
    console.log('OK : date dans l’API admin et tri, modification sans duplication, médias et UID conservés, brouillon distinct, publication, audit, idempotence, conflit et permissions.');
    if(process.env.ASSISTANT_UI_FIXTURE) {
      const fs=require('node:fs/promises');
      const fixture=process.env.ASSISTANT_UI_FIXTURE;
      assert.match(fixture,/^\/tmp\/assistant-ui-[a-z0-9-]+\.json$/);
      await fs.writeFile(fixture,JSON.stringify({email:user.email,password,documentId:doc.documentId,backend:base}),{mode:0o600});
      console.log('Recette navigateur prête.');
      try {
        for(let i=0;i<180;i++) {
          try {await fs.access(fixture+'.done');break;}catch {}
          await new Promise(resolve=>setTimeout(resolve,1000));
        }
      }finally{await fs.rm(fixture,{force:true});await fs.rm(fixture+'.done',{force:true});}
    }
  } finally {
    if(app)await app.destroy();
    if(created)await db.query(`DROP DATABASE "${database}" WITH (FORCE)`);
    await db.end();
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
