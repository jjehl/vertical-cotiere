// Real API, real PostgreSQL transaction and media provider; the editorial database is never used.
const assert=require('node:assert/strict');
const {randomBytes,createHash}=require('node:crypto');
const {Client}=require('pg');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {createServer}=require('node:http');
const {pathToFileURL}=require('node:url');
if(process.env.RUN_CONTENT_SYNC_TESTS!=='true')throw Error('RUN_CONTENT_SYNC_TESTS=true requis (base temporaire).');
const {createStrapi}=require('@strapi/strapi');
const base='http://127.0.0.1:1349';
const database='vertical_sync_test_'+randomBytes(6).toString('hex');
const connection={host:process.env.DATABASE_HOST,user:process.env.DATABASE_USERNAME,password:process.env.DATABASE_PASSWORD,database:process.env.DATABASE_NAME};
(async()=>{
  const db=new Client(connection);await db.connect();let app,created=false;const uploads=[];
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'vertical-sync-test-'));
  try{
    await db.query(`CREATE DATABASE "${database}"`);created=true;process.env.DATABASE_NAME=database;
    app=createStrapi();await app.register();app.app.bootstrap=async()=>{};
    app.config.set('admin.serveAdminPanel',false);app.config.set('server.port',1349);app.config.set('server.url',base);
    await app.bootstrap();app.isLoaded=true;await app.start();
    const request=async(route,body,token,method=body?'POST':'GET')=>{
      const response=await fetch(base+'/api/content-sync/'+route,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body instanceof FormData?{}:{'Content-Type':'application/json'})},...(body?{body:body instanceof FormData?body:JSON.stringify(body)}:{})});
      return {status:response.status,body:await response.json()};
    };
    const makeToken=async(name,actions)=>(await app.service('admin::api-token').create({name,type:'custom',lifespan:null,permissions:actions.map(action=>'api::content-sync.content-sync.'+action)})).accessKey;
    const sourceToken=await makeToken('export',['export','download']);
    const targetToken=await makeToken('import',['plan','upload','import']);
    assert([401,403].includes((await request('export')).status));
    assert.equal((await request('export',null,targetToken)).status,403);
    assert.equal((await request('plan',{},sourceToken)).status,403);
    const role=await app.db.query('plugin::users-permissions.role').findOne({where:{type:'authenticated'}});
    const user=await app.plugin('users-permissions').service('user').add({username:'sync@local.invalid',email:'sync@local.invalid',password:randomBytes(18).toString('hex'),provider:'local',confirmed:true,role:role.id});
    await app.db.query('plugin::users-permissions.permission').create({data:{role:role.id,action:'api::content-sync.content-sync.export'}});
    const memberToken=app.plugin('users-permissions').service('jwt').issue({id:user.id});
    assert.equal((await request('export',null,memberToken)).status,403);
    const png=await require('sharp')({create:{width:40,height:30,channels:3,background:'#224466'}}).png().toBuffer();
    const pdf=Buffer.from('%PDF-1.4\nrecette\n');
    const bytes=new Map();
    async function file(name,buffer,mime){
      const filepath=path.join(directory,name);await fs.writeFile(filepath,buffer);
      const [media]=await app.plugin('upload').service('upload').upload({data:{fileInfo:{name,alternativeText:'Description',caption:'Légende'}},files:{filepath,originalFilename:name,mimetype:mime,size:buffer.length}});
      uploads.push(media);
      // Strapi may optimize image bytes on upload; transfer the stored original, not the input PNG.
      const original=await fetch(base+'/api/content-sync/files/'+media.id,{headers:{Authorization:'Bearer '+sourceToken}});
      assert.equal(original.status,200);bytes.set(String(media.id),Buffer.from(await original.arrayBuffer()));return media;
    }
    const photo=await file('sync-photo.png',png,'image/png'),community=await file('sync-community.png',png,'image/png'),attachment=await file('sync.pdf',pdf,'application/pdf');
    const docs=app.documents('api::publication.publication');
    const source=await docs.create({data:{title:'Sortie transférée',slug:'sortie-sync',body:'Version publiée',category:'Sortie',photos:[photo.id],coverImage:photo.id,legacyBody:'Version publiée',legacyHtml:'<p>Photo <img src="/media/'+photo.id+'"><a href="/media/'+attachment.id+'">Document intégré</a></p>',meeting:{start:'2027-06-01T08:00:00.000Z',calendarUid:'identite-source@club'}},status:'published'});
    await docs.update({documentId:source.documentId,data:{body:'Brouillon privé'}});
    await app.db.query('api::member-upload.member-upload').create({data:{owner:user.id,file:community.id,publicationDocumentId:source.documentId}});
    const exported=await request('export?pageSize=1',null,sourceToken);assert.equal(exported.status,200,JSON.stringify(exported.body));
    const publication=exported.body.publications[0];assert.equal(publication.draft.body,'Brouillon privé');assert.equal(publication.published.body,'Version publiée');
    assert.equal(publication.published.photos.length,2);assert.equal(publication.files.length,3);
    assert(!JSON.stringify(publication).includes('sync@local.invalid'));assert(!JSON.stringify(publication).includes('memberAuthor'));
    const original=await fetch(base+'/api/content-sync/files/'+photo.id,{headers:{Authorization:'Bearer '+sourceToken}});
    assert.equal(original.status,200);assert.deepEqual(Buffer.from(await original.arrayBuffer()),bytes.get(String(photo.id)));
    for(const descriptor of publication.files)descriptor.sha256=createHash('sha256').update(bytes.get(descriptor.id)).digest('hex');
    assert.equal((await request('plan',{publication},targetToken)).status,400); // self transfer
    publication.sourceId='another-local-instance';
    assert.equal((await request('plan',{publication},targetToken)).body.action,'conflict'); // slug collision
    // Capture from a source and remove the fixture before importing as an independent instance.
    await docs.delete({documentId:source.documentId});
    await app.db.query('api::member-upload.member-upload').deleteMany({where:{publicationDocumentId:source.documentId}});
    const unrelated=await docs.create({data:{title:'Uniquement recette',category:'Vie du club'},status:'published'});
    const before=await docs.count();
    const preview=await request('plan',{publication},targetToken);assert.equal(preview.body.action,'create');assert.equal(preview.body.missingFiles.length,3);
    assert.equal(await docs.count(),before);assert.equal(await app.db.query('strapi::core-store').count({where:{key:{$contains:'publication-'}}}),0);
    assert.equal((await request('import',{publication},targetToken)).status,409);
    for(const descriptor of publication.files){
      const form=()=>{const result=new FormData();result.append('metadata',JSON.stringify(descriptor));result.append('files',new Blob([bytes.get(descriptor.id)],{type:descriptor.mime}),descriptor.name);return result;};
      const result=await request('files',form(),targetToken);assert.equal(result.status,200,JSON.stringify(result.body));
      const existing=await request('files',form(),targetToken);assert.equal(existing.body.id,result.body.id);assert.equal(existing.body.reused,true);
      uploads.push({id:result.body.id});
    }
    const usersBefore=await app.db.query('plugin::users-permissions.user').count();
    const imported=await request('import',{publication},targetToken);assert.equal(imported.status,200,JSON.stringify(imported.body));assert.equal(imported.body.action,'create');
    const documentId=imported.body.documentId;
    let published=await docs.findOne({documentId,status:'published',populate:{photos:true,attachments:true,coverImage:true,meeting:true}});
    let draft=await docs.findOne({documentId,populate:{photos:true,meeting:true}});
    assert.equal(published.body,'Version publiée');assert.equal(draft.body,'Brouillon privé');assert.equal(published.photos.length,2);assert.equal(published.attachments.length,1);
    assert.notEqual(published.photos[0].id,photo.id);assert(published.legacyHtml.includes('/media/'+published.photos[0].id));
    assert.equal(published.meeting.calendarUid,'identite-source@club');assert.equal(published.date,publication.published.date);
    const publicFile=await fetch(base+'/api/site-files/'+published.attachments[0].id);
    assert.equal(publicFile.status,200); // An inline-only source file is publicly accessible after import.
    assert.equal(await app.db.query('plugin::users-permissions.user').count(),usersBefore);
    assert.equal((await request('import',{publication},targetToken)).body.action,'unchanged');
    assert(await docs.findOne({documentId:unrelated.documentId}));
    // Independent edits merge, including destination-only community photos.
    await docs.update({documentId,data:{title:'Titre recette'}});
    await app.db.query('api::member-upload.member-upload').create({data:{owner:user.id,file:community.id,publicationDocumentId:documentId}});
    publication.draft.body='Correction locale';
    assert.equal((await request('import',{publication},targetToken)).body.action,'update');
    draft=await docs.findOne({documentId,populate:{photos:true}});assert.equal(draft.title,'Titre recette');assert.equal(draft.body,'Correction locale');
    assert(draft.photos.some(f=>f.id===community.id));
    assert.equal((await docs.findOne({documentId,status:'published'})).body,'Version publiée');
    publication.draft.title='Titre local';
    const conflict=await request('import',{publication},targetToken);assert.equal(conflict.body.action,'conflict');assert(conflict.body.conflicts.includes('draft.title'));
    assert.equal((await docs.findOne({documentId})).title,'Titre recette');
    // Align the conflicting field; simultaneous retries still create exactly one document.
    publication.draft.title='Titre recette';
    const concurrent=await Promise.all([request('import',{publication},targetToken),request('import',{publication},targetToken)]);
    assert(concurrent.every(result=>result.status===200&&result.body.action!=='conflict'));
    assert.equal((await docs.findMany({filters:{slug:'sortie-sync'}})).length,1);
    // Failure after document writes must roll back both versions and the correspondence.
    const beforeFailure=await docs.findOne({documentId});publication.draft.body='Modification à annuler';
    const originalQuery=app.db.query.bind(app.db);
    app.db.query=uid=>{const query=originalQuery(uid);return uid==='strapi::core-store'?{...query,update:async params=>{
      if(params.data?.value?.includes('Modification à annuler'))throw Error('Simulated persistence failure');return query.update(params);
    }}:query;};
    try{assert.equal((await request('import',{publication},targetToken)).status,500);}finally{app.db.query=originalQuery;}
    assert.equal((await docs.findOne({documentId})).body,beforeFailure.body);
    assert.equal((await request('import',{publication},targetToken)).body.action,'update');
    // Draft-only publications stay private, and an explicit first slug adoption keeps the target identity.
    const plain=structuredClone(publication);
    plain.documentId='draft-only-source';plain.files=[];plain.published=null;
    Object.assign(plain.draft,{slug:'brouillon-sync',title:'Brouillon transféré',photos:[],attachments:[],coverImage:null,legacyBody:null,legacyHtml:null});
    const privateResult=await request('import',{publication:plain},targetToken);assert.equal(privateResult.body.action,'create');
    assert.equal(await docs.findOne({documentId:privateResult.body.documentId,status:'published'}),null);
    const adoptionTarget=await docs.create({data:{title:'Fiche à rapprocher',slug:'adoption-sync',category:'Vie du club'}});
    plain.documentId='adoption-source';plain.draft.slug='adoption-sync';
    assert.equal((await request('import',{publication:plain},targetToken)).body.action,'conflict');
    const adopted=await request('import',{publication:plain,adoptSlug:true},targetToken);
    assert.equal(adopted.body.documentId,adoptionTarget.documentId);assert.equal(adopted.body.adopted,true);
    const renamed=await docs.create({data:{title:'Adresse publiée conservée',slug:'adresse-publiee',category:'Vie du club'},status:'published'});
    await docs.update({documentId:renamed.documentId,data:{slug:'nouvelle-adresse-en-brouillon'}});
    const collision=structuredClone(plain);collision.documentId='collision-source';collision.draft.slug='adresse-publiee';
    assert.equal((await request('plan',{publication:collision},targetToken)).body.action,'conflict');
    // Exercise the actual CLI against this Strapi target and a captured source HTTP API.
    const {run,options}=await import(pathToFileURL(process.env.CONTENT_SYNC_CLIENT_PATH||'/tmp/vertical-sync-client.mjs').href);
    const cliPublication=structuredClone(publication);cliPublication.documentId='cli-source';
    cliPublication.draft.slug='sortie-cli';cliPublication.published.slug='sortie-cli';
    for(const descriptor of cliPublication.files)descriptor.caption='Légende propre au test CLI';
    const sourceServer=createServer((req,res)=>{
      if(req.headers.authorization!=='Bearer fixture-source-token'){res.writeHead(403);res.end();return;}
      if(req.url.startsWith('/api/content-sync/export?')){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({version:1,publications:[cliPublication],pagination:{page:1,pageCount:1}}));return;}
      const id=req.url.match(/^\/api\/content-sync\/files\/(\d+)$/)?.[1];
      if(!bytes.has(id)){res.writeHead(404);res.end();return;}res.end(bytes.get(id));
    });
    await new Promise(resolve=>sourceServer.listen(0,'127.0.0.1',resolve));
    try{
      const config=options(['--from','http://127.0.0.1:'+sourceServer.address().port,'--to',base,'--dry-run']);
      const credentials={sourceToken:'fixture-source-token',targetToken,log:()=>{}};
      assert.equal((await run(config,credentials)).create,1);
      assert.equal(await docs.findFirst({filters:{slug:'sortie-cli'}}),null);
      config.dryRun=false;
      assert.equal((await run(config,credentials)).create,1);
      assert.equal((await run(config,credentials)).unchanged,1);
    }finally{sourceServer.closeAllConnections();await new Promise(resolve=>sourceServer.close(resolve));}
    console.log('OK : API réservée aux jetons, export complet, originaux S3, aperçu sans écriture, fusion, brouillons, conflits, absence de doublons, concurrence et rollback PostgreSQL.');
  }finally{
    if(app){for(const file of await app.db.query('plugin::upload.file').findMany())await app.plugin('upload').service('upload').remove(file).catch(()=>{});await app.destroy();}
    if(created)await db.query(`DROP DATABASE "${database}" WITH (FORCE)`);await db.end();await fs.rm(directory,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
