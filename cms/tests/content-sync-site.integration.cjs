const assert=require('node:assert/strict');
const {createHash,randomUUID}=require('node:crypto');
const {createServer}=require('node:http');
const model=require('../src/lib/content-sync-site-model');
module.exports=async function({app,request,sourceToken,targetToken,photo,attachment,bytes,run,options}){
  const sourceId='site-source-instance',contents={},sources={},targets={};
  const documents=app.documents(model.definitions.documents.uid),pages=app.documents(model.definitions.pages.uid),activities=app.documents(model.definitions.activities.uid),timetables=app.documents(model.definitions.timetable.uid);
  sources.documents=await documents.create({data:{title:'Document transférable',slug:'document-site-sync',category:'Vie du club',description:'Document du club',file:attachment.id},status:'published'});
  sources.activities=await activities.create({data:{title:'Cours transférable',slug:'cours-site-sync',summary:'Présentation',body:'Cours avec photo /media/'+photo.id,coverImage:photo.id},status:'published'});
  sources.pages=await pages.create({data:{title:'Page transférable',slug:'page-site-sync',bodyHtml:'<p>Version publique <a href="/document-files/document-site-sync">Document</a></p>',documents:[sources.documents.documentId]},status:'published'});
  await pages.update({documentId:sources.pages.documentId,data:{bodyHtml:'<p>Brouillon de page</p>'}});
  sources.timetable=await timetables.create({data:{season:'2026–2027',note:'Planning transférable',registrationsOpen:true,sessions:[{registrationCode:'site-sync-monday',label:'Cours du lundi',day:'Lundi',start:'17:00:00.000',end:'19:00:00.000',audience:'Adultes',capacity:20,supervised:true,registrationEnabled:true,occupiedPlaces:2,priceCents:20000,ccmpPriceCents:19000,familyPriceCents:18000,ccmpFamilyPriceCents:17000}],ufraps:{opens:'2026-09-01',closes:'2027-06-30',day:'Samedi',start:'10:00:00.000',end:'12:00:00.000',closures:[{label:'Vacances',from:'2026-12-20',until:'2027-01-03'}],closedDays:[{label:'Férié',date:'2027-05-01'}]},attachments:[attachment.id]},status:'published'});
  const stamp=content=>{content.sourceId=sourceId;for(const file of content.files)file.sha256=createHash('sha256').update(bytes.get(file.id)).digest('hex');for(const child of content.dependencies)stamp(child);return content;};
  for(const type of model.types){
    const exported=await request('export?type='+type,null,sourceToken);assert.equal(exported.status,200,JSON.stringify(exported.body));assert.equal(exported.body.version,2);assert.equal(exported.body.type,type);
    const content=exported.body.contents.find(content=>content.documentId===sources[type].documentId);assert(content);
    const self=structuredClone(content);for(const file of self.files)file.sha256=createHash('sha256').update(bytes.get(file.id)).digest('hex');for(const child of self.dependencies)for(const file of child.files)file.sha256=createHash('sha256').update(bytes.get(file.id)).digest('hex');
    assert.equal((await request('plan',{content:self},targetToken)).status,400);
    contents[type]=stamp(content);
  }
  for(const type of ['course-registration','users','admin','unknown'])assert.equal((await request('export?type='+type,null,sourceToken)).status,400);
  assert.equal((await request('export?type=pages',null,targetToken)).status,403);
  assert.equal(contents.timetable.draft.sessions[0].id,undefined);assert.equal(contents.timetable.draft.ufraps.closures[0].id,undefined);
  assert.equal(contents.pages.dependencies.length,1);assert.deepEqual(contents.pages.published.documents,[sources.documents.documentId]);
  assert(contents.pages.published.bodyHtml.includes('/media/'+attachment.id));
  assert.equal(contents.pages.draft.bodyHtml,'<p>Brouillon de page</p>');
  for(const type of ['pages','activities','documents','timetable'])await app.documents(model.definitions[type].uid).delete({documentId:sources[type].documentId});
  const mediaCount=await app.db.query('plugin::upload.file').count();
  const pagePlan=await request('plan',{content:contents.pages},targetToken);assert.equal(pagePlan.body.action,'create');assert.equal(pagePlan.body.missingReferences.length,1);
  assert.equal(await pages.count(),0);assert.equal(await app.db.query('plugin::upload.file').count(),mediaCount);
  assert.equal((await request('import',{content:contents.pages},targetToken)).status,409);
  const usersCount=await app.db.query('plugin::users-permissions.user').count();
  const importOne=async content=>{
    const result=await request('import',{content},targetToken);assert.equal(result.status,200,JSON.stringify(result.body));return result.body;
  };
  for(const type of model.types){
    const result=await importOne(contents[type]);assert.equal(result.action,'create',type+': '+JSON.stringify(result));targets[type]=result.documentId;
    assert.notEqual(result.documentId,sources[type].documentId);assert.equal((await importOne(contents[type])).action,'unchanged',type);
  }
  const page=await pages.findOne({documentId:targets.pages,status:'published',populate:{attachments:true,documents:true}});
  const document=await documents.findOne({documentId:targets.documents,status:'published',populate:{file:true}});
  assert.deepEqual(page.documents.map(row=>row.documentId),[targets.documents]);assert(page.bodyHtml.includes('/media/'+document.file.id));assert.notEqual(document.file.id,attachment.id);
  assert.equal((await pages.findOne({documentId:targets.pages})).bodyHtml,'<p>Brouillon de page</p>');
  assert.equal(await app.db.query('plugin::users-permissions.user').count(),usersCount);
  const timetable=await timetables.findOne({documentId:targets.timetable,status:'published',populate:model.definitions.timetable.populate});
  assert.equal(timetable.sessions[0].priceCents,20000);assert.equal(timetable.sessions[0].ccmpFamilyPriceCents,17000);assert.equal(timetable.sessions[0].occupiedPlaces,2);assert.equal(timetable.registrationsOpen,true);assert.equal(timetable.ufraps.closedDays[0].date,'2027-05-01');
  const catalogResponse=await fetch('http://127.0.0.1:1349/api/registrations');assert.equal(catalogResponse.status,200);const catalog=await catalogResponse.json();
  assert.equal(catalog.open,true);assert.equal(catalog.sessions[0].remaining,18);assert.deepEqual(catalog.sessions[0].prices,{STANDARD:20000,CCMP1OU2:19000,FAM:18000,CCMP3:17000});
  const publicResponse=await fetch('http://127.0.0.1:1349/api/site-content');assert.equal(publicResponse.status,200);const publicContent=await publicResponse.json();
  const publicPage=publicContent.pages.find(row=>row.slug==='page-site-sync');assert(publicPage.bodyHtml.includes('/media/'+document.file.id));assert.equal(publicPage.documents[0].slug,'document-site-sync');
  assert.equal(publicContent.activities.find(row=>row.slug==='cours-site-sync').title,'Cours transférable');assert.equal(publicContent.activities.find(row=>row.slug==='cours-site-sync').imagePosition,'100% 45%');assert.equal(publicContent.timetable.ufraps.closedDays[0].date,'2027-05-01');
  const image=contents.activities.files.find(file=>file.id===String(photo.id));
  const mediaStore=require('../src/lib/content-sync-service').store(app,'media-'+require('../src/lib/content-sync-model').mediaKey(image));
  const mediaRecord=await mediaStore.get();
  await mediaStore.set({value:{id:mediaRecord.id}});
  await app.db.query('plugin::upload.file').update({where:{id:mediaRecord.id},data:{focalPoint:null}});
  const framingPreview=await request('plan',{content:contents.activities},targetToken);assert.equal(framingPreview.body.action,'update');assert.deepEqual(framingPreview.body.missingFiles.map(file=>file.id),[image.id]);
  assert.equal((await app.db.query('plugin::upload.file').findOne({where:{id:mediaRecord.id}})).focalPoint,null);
  const imageForm=new FormData();imageForm.append('metadata',JSON.stringify(image));imageForm.append('files',new Blob([bytes.get(image.id)],{type:image.mime}),image.name);
  const framingUpdate=await request('files',imageForm,targetToken);assert.equal(framingUpdate.status,200);assert.equal(framingUpdate.body.id,mediaRecord.id);
  const repairedPublic=await(await fetch('http://127.0.0.1:1349/api/site-content')).json();assert.equal(repairedPublic.activities.find(row=>row.slug==='cours-site-sync').imagePosition,'100% 45%');
  assert.equal((await request('plan',{content:contents.activities},targetToken)).body.action,'unchanged');
  // Independent edits of the same course merge by registrationCode and by field.
  await timetables.update({documentId:targets.timetable,data:{sessions:[{...model.dataFromRow('timetable',timetable).sessions[0],capacity:25}]},status:'published'});
  for(const version of ['draft','published'])contents.timetable[version].sessions[0].priceCents=21000;
  assert.equal((await importOne(contents.timetable)).action,'update');
  let updated=await timetables.findOne({documentId:targets.timetable,status:'published',populate:model.definitions.timetable.populate});assert.equal(updated.sessions[0].capacity,25);assert.equal(updated.sessions[0].priceCents,21000);
  const concurrent=structuredClone(contents.timetable);concurrent.published.sessions[0].capacity=30;
  const conflict=await importOne(concurrent);assert.equal(conflict.action,'conflict');assert(conflict.conflicts.some(field=>field.endsWith('.capacity')));
  // Destination reservations survive the sync and prevent an insufficient capacity.
  const reservation=await app.db.query('api::course-registration.course-registration').create({data:{reference:randomUUID(),season:'2026–2027',slotCode:'site-sync-monday',slotLabel:'Cours du lundi',firstName:'Test',lastName:'Cible',birthDate:'1990-01-01',email:'target@local.invalid',payerFirstName:'Test',payerLastName:'Cible',address:'Adresse de recette',amountCents:21000,registrationStatus:'pending'}});
  const unsafe=structuredClone(contents.timetable);for(const version of ['draft','published'])Object.assign(unsafe[version].sessions[0],{capacity:25,occupiedPlaces:25});
  const protectedResult=await importOne(unsafe);assert.equal(protectedResult.action,'conflict');assert(protectedResult.conflicts.some(field=>field.includes('inscriptions de la cible')));
  const seasonChange=structuredClone(contents.timetable);for(const version of ['draft','published'])seasonChange[version].season='2027–2028';
  assert((await importOne(seasonChange)).conflicts.some(field=>field.includes('paiements en cours')));
  assert.equal((await app.db.query('api::course-registration.course-registration').findOne({where:{id:reservation.id}})).registrationStatus,'pending');
  for(const change of [value=>value.type='course-registration',value=>value.draft.sessions[0].id=123,value=>value.draft.sessions[0].priceCents=-1,value=>value.draft.secret='forbidden']){const bad=structuredClone(contents.timetable);change(bad);assert.equal((await request('import',{content:bad},targetToken)).status,400);}
  assert.equal((await request('import',{publication:contents.pages,content:contents.pages},targetToken)).status,400);
  // The singleton, like an existing page, requires explicit first adoption.
  const adopt=structuredClone(contents.timetable);adopt.sourceId='new-site-source';
  assert.equal((await importOne(adopt)).action,'conflict');
  const adopted=await request('import',{content:adopt,adoptSlug:true},targetToken);assert.equal(adopted.status,200,JSON.stringify(adopted.body));assert.equal(adopted.body.documentId,targets.timetable);assert(adopted.body.adopted);
  // A write failure rolls back both the content and its merge baseline.
  const before=await pages.findOne({documentId:targets.pages});const changed=structuredClone(contents.pages);changed.draft.bodyHtml='Écriture à annuler';
  const originalQuery=app.db.query.bind(app.db);
  app.db.query=uid=>{const query=originalQuery(uid);return uid==='strapi::core-store'?{...query,update:async params=>{if(params.data?.value?.includes('Écriture à annuler'))throw Error('Simulated site persistence failure');return query.update(params);}}:query;};
  try{assert.equal((await request('import',{content:changed},targetToken)).status,500);}finally{app.db.query=originalQuery;}
  assert.equal((await pages.findOne({documentId:targets.pages})).bodyHtml,before.bodyHtml);
  // Actual CLI --type all: documents precede pages, and old publication v1 remains supported.
  const source=createServer((req,res)=>{
    if(req.headers.authorization!=='Bearer site-source-token'){res.writeHead(403);res.end();return;}
    const url=new URL(req.url,'http://local.invalid');
    if(url.pathname==='/api/content-sync/export'){
      const type=url.searchParams.get('type')||'publications';
      res.setHeader('Content-Type','application/json');res.end(JSON.stringify(type==='publications'?{version:1,publications:[],pagination:{page:1,pageCount:0}}:{version:2,type,contents:[contents[type]],pagination:{page:1,pageCount:1}}));return;
    }
    const id=url.pathname.match(/^\/api\/content-sync\/files\/(\d+)$/)?.[1];if(!bytes.has(id)){res.writeHead(404);res.end();return;}res.end(bytes.get(id));
  });
  await new Promise(resolve=>source.listen(0,'127.0.0.1',resolve));
  try{
    const config=options(['--from','http://127.0.0.1:'+source.address().port,'--to','http://127.0.0.1:1349','--type','all','--dry-run']);
    const credentials={sourceToken:'site-source-token',targetToken,log:()=>{}};
    const preview=await run(config,credentials);assert.equal(preview.failed,0);assert.equal(preview.conflict,0);assert.equal(preview.unchanged,4);
    config.dryRun=false;const repeated=await run(config,credentials);assert.equal(repeated.failed,0);assert.equal(repeated.unchanged,4);
  }finally{source.closeAllConnections();await new Promise(resolve=>source.close(resolve));}
  console.log('OK site complet : pages, activités, documents liés, médias, brouillons, planning, tarifs, UFRAPS, fusion par cours, réservations conservées, aperçu, types privés refusés, singleton, relance et rollback.');
};
