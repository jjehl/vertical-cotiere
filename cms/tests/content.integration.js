// Runs only against a dedicated Compose test project. Never use the club database.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createStrapi}=require('@strapi/strapi');
if(process.env.RUN_CONTENT_TESTS!=='true')throw new Error('RUN_CONTENT_TESTS=true requis sur une base de recette isolée.');
const populate={sessions:true,ufraps:{populate:{closures:true,closedDays:true}},attachments:true};
(async()=>{
  let ready=false;
  for(let attempt=0;attempt<60;attempt++){
    try{if((await fetch('http://127.0.0.1:1337/_health')).ok){ready=true;break;}}catch{}
    await new Promise(resolve=>setTimeout(resolve,1000));
  }
  if(!ready)throw new Error('CMS de recette indisponible');
  const app=await createStrapi().load();
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'vertical-content-'));
  const docs=app.documents('api::club-document.club-document');
  const publications=app.documents('api::publication.publication');
  const timetable=app.documents('api::club-timetable.club-timetable');
  const uploads=[];const created=[];
  const webAddress=(await require('node:dns/promises').lookup('web',{family:4})).address;
  const website=url=>fetch('http://'+webAddress+':3000'+url);
  const api=async url=>{
    const r=await fetch('http://127.0.0.1:1337/api/'+url);
    return {status:r.status,body:await r.json()};
  };
  async function upload(name,bytes,type) {
    const filepath=path.join(dir,name);await fs.writeFile(filepath,bytes);
    const [file]=await app.plugin('upload').service('upload').upload({data:{fileInfo:{name,caption:'Photo de recette'}},files:{filepath,originalFilename:name,mimetype:type,size:bytes.length}});
    uploads.push(file);return file;
  }
  const original=await timetable.findFirst({populate});
  const clean=value=>Array.isArray(value)?value.map(clean):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).filter(([k])=>!['id','documentId','createdAt','updatedAt','publishedAt'].includes(k)).map(([k,v])=>[k,clean(v)])):value;
  const restore={season:original.season,note:original.note,sessions:clean(original.sessions),ufraps:clean(original.ufraps),attachments:original.attachments.map(f=>f.id)};
  try {
    const image=await upload('integration.png',await require('sharp')({create:{width:40,height:30,channels:3,background:'#cc4b27'}}).png().toBuffer(),'image/png');
    const publication=await publications.create({data:{title:'Publication de recette',body:'Le compte rendu de notre sortie.',photos:[image.id]}});
    const slug=publication.slug;
    created.push([publications,publication.documentId]);
    const detail=()=>api('publications/'+slug);
    assert.equal((await detail()).status,404);
    assert.equal((await api('site-files/'+image.id)).status,404);
    assert.equal((await website('/media/'+image.id)).status,404);
    await publications.publish({documentId:publication.documentId});
    let response=await detail();assert.equal(response.status,200);
    assert.equal(response.body.photos[0].src,'/media/'+image.id);
    assert.equal(response.body.image,'/media/'+image.id);
    assert.equal(response.body.photos[0].title,'Photo de recette');
    assert(response.body.date);assert.equal(response.body.meeting,null);
    assert.equal((await website('/media/'+image.id)).status,200);
    await app.plugin('upload').service('upload').updateFileInfo(image.id,{caption:'Nouvelle légende'});
    assert.equal((await detail()).body.photos[0].title,'Nouvelle légende');
    const secondImage=await upload('integration-2.png',await require('sharp')({create:{width:40,height:30,channels:3,background:'#223b31'}}).png().toBuffer(),'image/png');
    await publications.update({documentId:publication.documentId,data:{body:'Un compte rendu enrichi.',photos:[secondImage.id,image.id],meeting:{start:'2027-03-28T00:00:00.000Z',allDay:true,location:'Beynost'}}});
    assert.equal((await detail()).body.meeting,null);
    assert.equal((await detail()).body.body,'Le compte rendu de notre sortie.');
    await publications.publish({documentId:publication.documentId});
    response=await detail();
    assert.equal(response.body.body,'Un compte rendu enrichi.');
    assert.equal(response.body.image,'/media/'+secondImage.id);
    assert.deepEqual(response.body.photos.map(p=>p.id),[secondImage.id,image.id]);
    assert.equal(response.body.meeting.startDate,'2027-03-28');
    assert.equal(response.body.meeting.endDate,'2027-03-29');
    assert.equal(response.body.meeting.end,'2027-03-28T22:00:00.000Z');
    assert((await api('site-content')).body.events.some(e=>e.slug===slug));
    const ics=await(await website('/api/agenda.ics?evenement='+slug)).text();
    assert.match(ics,/DTSTART;VALUE=DATE:20270328/);
    assert.match(ics,/DTEND;VALUE=DATE:20270329/);
    assert.match(ics,new RegExp('URL:.*?/vie-du-club/'+slug));
    assert.match(await(await website('/vie-du-club/'+slug)).text(),/Un compte rendu enrichi/);
    await assert.rejects(publications.update({documentId:publication.documentId,data:{meeting:{id:(await publications.findOne({documentId:publication.documentId,populate:{meeting:true}})).meeting.id,end:'2027-03-27T00:00:00.000Z'}}}),/terminer après/);
    await publications.update({documentId:publication.documentId,data:{meeting:null},status:'published'});
    assert(!(await api('site-content')).body.events.some(e=>e.slug===slug));
    assert.equal((await detail()).body.photos.length,2);
    await publications.unpublish({documentId:publication.documentId});
    assert.equal((await detail()).status,404);
    assert.equal((await api('site-files/'+image.id)).status,404);
    console.log('✓ Publication unique : texte, photos, couverture, légende, brouillon et agenda synchronisés, ICS et heure d’été');

    const archived=app.documents('api::article.article');
    const old=await archived.create({data:{title:'Archive de recette',slug:'recette-archive',body:'Version publiée',bodyHtml:'<p>Version publiée</p>',date:'2020-01-01',coverImage:image.id},status:'published'});
    created.push([archived,old.documentId]);
    await archived.update({documentId:old.documentId,data:{body:'Version en brouillon',bodyHtml:'<p>Version en brouillon</p>'}});
    const marker=app.store({type:'core',name:'vertical-admin',key:'publications-v1'});
    await marker.set({value:false});
    await require('../src/lib/migrate-publications')(app);
    const imported=await publications.findFirst({filters:{legacyKey:'article:'+old.documentId}});
    created.push([publications,imported.documentId]);
    assert.equal(imported.body,'Version en brouillon');
    assert.equal((await publications.findOne({documentId:imported.documentId,status:'published'})).body,'Version publiée');
    const total=await publications.count();
    await marker.set({value:false});await require('../src/lib/migrate-publications')(app);
    assert.equal(await publications.count(),total);
    await publications.update({documentId:imported.documentId,data:{body:'Texte corrigé'},status:'published'});
    const edited=(await api('publications/'+imported.slug)).body;
    assert.equal(edited.body,'Texte corrigé');assert.equal(edited.bodyHtml,'');
    await publications.unpublish({documentId:imported.documentId});
    assert.equal((await api('site-files/'+image.id)).status,404); // Published legacy rows must not leak files.
    console.log('✓ Migration rejouable, conservation des brouillons et du HTML, archives exclues des accès publics');

    const first=await upload('premier.pdf',Buffer.from('%PDF-1.4\nFirst revision\n%%EOF'),'application/pdf');
    const second=await upload('second.pdf',Buffer.from('%PDF-1.4\nSecond revision\n%%EOF'),'application/pdf');
    const doc=await docs.create({data:{title:'Document de recette',slug:'recette-document',file:first.id},status:'published'});
    created.push([docs,doc.documentId]);
    assert.equal((await api('library/recette-document')).body.id,first.id);
    assert.match(await(await website('/document-files/recette-document')).text(),/First revision/);
    await docs.update({documentId:doc.documentId,data:{file:second.id}});
    assert.equal((await api('library/recette-document')).body.id,first.id);
    await docs.publish({documentId:doc.documentId});
    assert.equal((await api('library/recette-document')).body.id,second.id);
    assert.match(await(await website('/document-files/recette-document')).text(),/Second revision/);
    assert.equal((await api('site-files/'+first.id)).status,404);
    console.log('✓ Remplacement de document : adresse stable et brouillon préservé');

    const pages=app.documents('api::page.page');
    const resource=await pages.create({data:{slug:'recette-documents-page',title:'Page de recette',bodyHtml:'<p>Documents du club</p>',documents:[doc.documentId]},status:'published'});
    created.push([pages,resource.documentId]);
    const linkedDocuments=async()=>((await api('site-content')).body.pages.find(p=>p.slug==='recette-documents-page')).documents;
    assert.equal((await linkedDocuments()).length,1);
    assert.equal((await linkedDocuments())[0].url,'/document-files/recette-document');
    await docs.update({documentId:doc.documentId,data:{title:'Titre de document modifié'}});
    assert.equal((await linkedDocuments())[0].title,'Document de recette');
    await docs.publish({documentId:doc.documentId});
    assert.equal((await linkedDocuments())[0].title,'Titre de document modifié');
    const rendered=await(await website('/ressources/recette-documents-page')).text();
    assert.match(rendered,/Titre de document modifié/);
    await docs.unpublish({documentId:doc.documentId});
    assert.deepEqual(await linkedDocuments(),[]);
    await docs.publish({documentId:doc.documentId});
    assert.equal((await linkedDocuments()).length,1);
    console.log('✓ Documents liés aux pages : titre, brouillon, publication et retrait synchronisés');

    await app.plugin('upload').service('upload').updateFileInfo(image.id,{alternativeText:'Grimpeuse de recette',focalPoint:{x:100,y:45}});
    const activities=app.documents('api::activity.activity');
    const activity=await activities.create({data:{title:'Cours de recette',slug:'recette-cours',summary:'Cours',coverImage:image.id},status:'published'});
    created.push([activities,activity.documentId]);
    const cover=(await api('site-content')).body.activities.find(a=>a.slug==='recette-cours');
    assert.equal(cover.imagePosition,'100% 45%');
    assert.equal(cover.imageAlt,'Grimpeuse de recette');
    console.log('✓ Couverture : texte alternatif et point focal lus depuis la médiathèque');


    const modified=structuredClone(restore);
    modified.ufraps.start='09:00:00.000';
    modified.ufraps.closedDays.push({date:'2027-06-12',label:'Fermeture de recette'});
    await timetable.update({documentId:original.documentId,data:modified});
    assert.equal((await api('site-content')).body.timetable.ufraps.start,'10:00');
    await timetable.publish({documentId:original.documentId});
    const publicPlan=(await api('site-content')).body.timetable;
    assert.equal(publicPlan.ufraps.start,'09:00');
    assert(publicPlan.ufraps.closedDays.some(d=>d.date==='2027-06-12'));
    const invalid=structuredClone(modified);invalid.ufraps.end='08:00:00.000';
    await assert.rejects(timetable.update({documentId:original.documentId,data:invalid}),/heure de fin/);
    invalid.ufraps.end='12:00:00.000';invalid.ufraps.closures=[{label:'Inversée',from:'2027-04-12',until:'2027-04-10'}];
    await assert.rejects(timetable.update({documentId:original.documentId,data:invalid}),/fin doit suivre/);
    await assert.rejects(timetable.update({documentId:original.documentId,data:{ufraps:{id:(await timetable.findFirst({populate})).ufraps.id,end:'08:00:00.000'}}}),/heure de fin/);
    console.log('✓ Horaires, jours fermés, publication et refus des périodes inversées, y compris mise à jour partielle');
    const configuration=await app.plugin('content-manager').service('content-types').findConfiguration(app.contentTypes['api::club-timetable.club-timetable']);
    assert.equal(configuration.metadatas.sessions.edit.label,'Créneaux de cours');
    const publicationConfig=await app.plugin('content-manager').service('content-types').findConfiguration(app.contentTypes['api::publication.publication']);
    assert.equal(publicationConfig.metadatas.slug.edit.visible,false);
    assert.equal(publicationConfig.metadatas.photos.edit.label,'Photos (facultatif)');
    for(const type of ['article','event','album'])assert.equal(app.contentTypes[`api::${type}.${type}`].pluginOptions['content-manager'].visible,false);
    const pageConfig=await app.plugin('content-manager').service('content-types').findConfiguration(app.contentTypes['api::page.page']);
    assert.equal(pageConfig.metadatas.structuredData.edit.visible,false);
    console.log('✓ Libellés des formulaires français et masquage des champs JSON historiques');
  } finally {
    await timetable.update({documentId:original.documentId,data:restore,status:'published'});
    for(const [service,documentId] of created.reverse())await service.delete({documentId});
    for(const file of uploads)await app.plugin('upload').service('upload').remove(file);
    await fs.rm(dir,{recursive:true,force:true});await app.destroy();
  }
})().catch(error=>{console.error(error);process.exit(1)});
