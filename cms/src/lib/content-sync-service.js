const {randomUUID,createHash}=require('node:crypto');
const fs=require('node:fs');
const path=require('node:path');
const {Readable}=require('node:stream');
const model=require('./content-sync-model');
const uid='api::publication.publication';
const populate={photos:true,attachments:true,coverImage:true,meeting:true};
const store=(app,key)=>app.store({type:'core',name:'vertical-content-sync',key});
const fail=(status,message)=>{const error=new Error(message);error.status=status;throw error;};
const locked=(app,callback)=>app.db.transaction(async({trx})=>{
  // Shared by all workers and independent of in-process locks. Strapi queries use this transaction.
  await trx.raw('SELECT pg_advisory_xact_lock(hashtext(?))',['vertical-content-sync-v1']);
  return callback(trx);
});
async function instanceId(app){
  return locked(app,async()=>{
    const entry=store(app,'instance');let value=await entry.get();
    if(!value){value=randomUUID();await entry.set({value});}return value;
  });
}
async function versions(app,documentId){
  const docs=app.documents(uid);
  const rows=await Promise.all(['draft','published'].map(status=>docs.findOne({documentId,status,populate})));
  const enriched=await require('./publication-photos').withCommunityPhotos(app,rows.filter(Boolean));
  let index=0;
  return Object.fromEntries(['draft','published'].map((status,i)=>[status,rows[i]?model.dataFromRow(enriched[index++]):null]));
}
async function exportPage(app,{page=1,pageSize=10,slug}={}){
  const sourceId=await instanceId(app),docs=app.documents(uid);
  const filters=slug?{slug}:{};
  const total=await docs.count({status:'draft',filters});
  const rows=await docs.findMany({status:'draft',filters,sort:'documentId:asc',start:(page-1)*pageSize,limit:pageSize,fields:['documentId']});
  const publications=[];
  for(const row of rows){
    const data=await versions(app,row.documentId);
    const files=await prepareMedia(app,data);
    publications.push({version:1,sourceId,documentId:row.documentId,...data,files});
  }
  return {version:1,sourceId,publications,pagination:{page,pageSize,total,pageCount:Math.ceil(total/pageSize)}};
}
async function prepareMedia(app,data,{lists=['photos','attachments'],singles=['coverImage'],texts=['body','legacyBody','legacyHtml']}={}){
  const mediaIndex=await require('./media-urls').getMediaIndex(app);
  const ids=new Set(),embedded={draft:new Set(),published:new Set()};
  for(const [status,version] of Object.entries(data)){
    if(!version)continue;
    for(const key of lists)version[key].forEach(id=>ids.add(id));
    for(const key of singles)if(version[key])ids.add(version[key]);
    for(const key of texts){
      if(!version[key])continue;
      const site=(process.env.PUBLIC_SITE_URL||'http://localhost:3000').replace(/\/$/,'');
      for(const prefix of ['/media/','/document-files/','/imports/','/gallery/'])version[key]=version[key].split(site+prefix).join(prefix);
      // Old document aliases are exported as file references, without importing club-document records.
      for(const match of version[key].matchAll(/(?<![a-zA-Z0-9_:/.-])\/document-files\/([a-zA-Z0-9_-]+)/g)){
        const document=await app.documents('api::club-document.club-document').findFirst({status:'published',filters:{slug:match[1]},populate:{file:true}});
        if(!document?.file)fail(422,'Document intégré introuvable : '+match[1]);
        version[key]=version[key].split(match[0]).join('/media/'+document.file.id);
      }
      version[key]=version[key].replace(/(?<![a-zA-Z0-9_:/.-])\/imports\/[a-zA-Z0-9_.-]+/g,url=>{
        const asset=mediaIndex.assets?.[url];if(!asset?.mediaId)fail(422,'Fichier historique introuvable : '+url);
        return '/media/'+asset.mediaId;
      }).replace(/(?<![a-zA-Z0-9_:/.-])\/gallery\/(\d+)-(original|thumb)\.(?:jpe?g|png|gif|webp)/gi,(url,sourceId,variant)=>{
        const id=mediaIndex.photos?.[sourceId];if(!id)fail(422,'Photo historique introuvable : '+url);return '/media/'+id+(variant==='thumb'?'?variant=thumbnail':'');
      });
      for(const match of version[key].matchAll(model.mediaPattern())){ids.add(match[1]);embedded[status].add(match[1]);}
    }
  }
  const files=[];
  for(const id of ids){
    const file=await app.db.query('plugin::upload.file').findOne({where:{id:Number(id)}});
    if(!file)fail(422,'Fichier source introuvable : '+id);
    files.push({id:String(file.id),name:file.name,mime:file.mime,alternativeText:file.alternativeText||'',caption:file.caption||''});
    // Inline files also need a public relation on their owning content.
    for(const [status,version] of Object.entries(data))if(version&&embedded[status].has(id)&&!lists.some(key=>version[key].includes(id))&&!singles.some(key=>version[key]===id)){
      const field=lists.includes('photos')&&file.mime.startsWith('image/')?'photos':lists.includes('attachments')?'attachments':null;
      if(!field)fail(422,'Le fichier intégré ne peut pas être rattaché à ce type de contenu : '+id);
      version[field].push(id);
    }
  }
  return files;
}
async function download(app,id){
  const file=await app.db.query('plugin::upload.file').findOne({where:{id}});
  if(!file)fail(404,'Fichier introuvable.');
  if(file.provider==='local'){
    if(!/^\/uploads\/[a-zA-Z0-9_.-]+$/.test(file.url))fail(422,'Chemin de fichier invalide.');
    return {file,stream:fs.createReadStream(path.join(app.dirs.static.public,'uploads',path.basename(file.url)))};
  }
  const base=new URL((process.env.S3_PUBLIC_URL||'').replace(/\/$/,'')+'/');
  const url=new URL(file.url);
  if(url.origin!==base.origin||!url.pathname.startsWith(base.pathname)||url.search||url.hash||url.username||url.password)fail(422,'URL de stockage invalide.');
  const key=url.pathname.slice(base.pathname.length);
  if(!key||key.split('/').some(part=>part==='..'||part==='.')||!(/^[a-zA-Z0-9_./-]+$/).test(key))fail(422,'Clé de stockage invalide.');
  // SeaweedFS is reachable by its Docker endpoint, not by localhost from inside the CMS.
  const address=process.env.S3_FORCE_PATH_STYLE!=='false'?`${process.env.S3_ENDPOINT?.replace(/\/$/,'')}/${process.env.S3_BUCKET}/${key}`:url.href;
  const response=await fetch(address,{redirect:'error',signal:AbortSignal.timeout(120000)});
  if(!response.ok||!response.body)fail(502,'Lecture du fichier source impossible.');
  return {file,stream:Readable.fromWeb(response.body)};
}
async function mediaMapping(app,publication){
  const mapping=new Map(),symbolic=new Map(),missing=[];
  for(const file of publication.files){
    const key=model.mediaKey(file);symbolic.set(file.id,key);
    const record=await store(app,'media-'+key).get();
    const exists=record&&await app.db.query('plugin::upload.file').findOne({where:{id:record.id}});
    if(exists)mapping.set(file.id,String(record.id));
    else {mapping.set(file.id,'pending-'+key);missing.push(file);}
  }
  return {mapping,symbolic,missing};
}
async function plan(app,publication,{adoptSlug=false,trx}={}){
  try{model.validatePublication(publication);}catch(error){fail(400,error.message);}
  if(publication.sourceId===await store(app,'instance').get())fail(400,'La source et la destination sont la même instance.');
  const key='publication-'+model.digest([publication.sourceId,publication.documentId]);
  const record=await store(app,key).get();
  const docs=app.documents(uid);
  let documentId=record?.documentId;
  if(documentId&&!await docs.findOne({documentId,status:'draft'}))return {action:'conflict',conflicts:['Publication supprimée en destination.'],key};
  const slug=publication.draft.slug;
  const slugFilter={slug:{$in:[...new Set([slug,publication.published?.slug].filter(Boolean))]}};
  const matches=[...new Map((await Promise.all(['draft','published'].map(status=>docs.findMany({status,filters:slugFilter,fields:['documentId'],limit:3})))).flat().map(row=>[row.documentId,row])).values()];
  const others=matches.filter(row=>row.documentId!==documentId);
  if(others.length){
    if(!documentId&&adoptSlug&&others.length===1)documentId=others[0].documentId;
    else return {action:'conflict',conflicts:['Slug déjà utilisé : '+slug+' (rapprochement explicite requis).'],key};
  }
  if(documentId&&trx){
    const metadata=app.db.metadata.get(uid);
    await trx(metadata.tableName).where(metadata.attributes.documentId.columnName,documentId).forUpdate();
  }
  const current=documentId?await versions(app,documentId):{draft:null,published:null};
  const {mapping,symbolic,missing}=await mediaMapping(app,publication);
  const incoming={draft:model.mapData(publication.draft,symbolic),published:model.mapData(publication.published,symbolic)};
  const desired={draft:model.mapData(publication.draft,mapping),published:model.mapData(publication.published,mapping)};
  const merged={},baseline={},conflicts=[];
  for(const version of ['draft','published']){
    const result=model.mergeVersion(incoming[version],record?.source?.[version],current[version],record?.target?.[version],desired[version]);
    merged[version]=result.data;baseline[version]=result.baseline;
    conflicts.push(...result.conflicts.map(field=>version+'.'+field));
  }
  if(conflicts.length)return {action:'conflict',conflicts,key,documentId};
  const action=!documentId?'create':model.equal(current,merged)?'unchanged':'update';
  return {action,key,documentId,incoming,merged,baseline,current,missingFiles:action==='unchanged'?[]:missing,adopted:!record&&Boolean(documentId)};
}
const publicPlan=result=>({action:result.action,documentId:result.documentId,conflicts:result.conflicts||[],missingFiles:result.missingFiles||[],adopted:result.adopted||false});
async function importPublication(app,publication,options){
  return locked(app,async trx=>{
    const result=await plan(app,publication,{...options,trx});
    if(result.action==='conflict')return publicPlan(result);
    if(result.missingFiles.length)fail(409,'Transférer les fichiers manquants avant la publication.');
    const docs=app.documents(uid);let documentId=result.documentId;
    const writeData=data=>({...data,photos:data.photos.map(Number),attachments:data.attachments.map(Number),coverImage:data.coverImage?Number(data.coverImage):null});
    if(result.action!=='unchanged'){
      const publishedChanged=result.merged.published&&!model.equal(result.current.published,result.merged.published);
      const first=result.merged.published||result.merged.draft;
      if(!documentId){const created=await docs.create({data:writeData(first),...(result.merged.published?{status:'published'}:{})});documentId=created.documentId;}
      else if(publishedChanged)await docs.update({documentId,data:writeData(result.merged.published),status:'published'});
      // Publishing writes the draft as well; always restore its independently merged version.
      if(!model.equal(result.merged.draft,first)||result.documentId)await docs.update({documentId,data:writeData(result.merged.draft)});
    }
    // Store baselines in the same transaction as the documents. A lost HTTP response can be retried.
    await store(app,result.key).set({value:{documentId,source:result.incoming,target:result.baseline}});
    return {...publicPlan(result),documentId};
  });
}
async function upload(app,file,metadata){
  if(!file||Array.isArray(file)||!file.size||file.size>50*1024*1024)fail(400,'Un seul fichier, de 50 Mo maximum, est requis.');
  const descriptor={...metadata,id:'1'};
  // Reuse the exchange validator without accepting arbitrary upload metadata.
  const sample={title:'Fichier',slug:'fichier',category:'Vie du club',body:null,date:null,meeting:null,legacyKey:null,legacyType:null,legacySlug:null,legacyBody:null,legacyHtml:null,legacySummary:null,photos:['1'],attachments:[],coverImage:null};
  try{model.validatePublication({version:1,sourceId:'upload',documentId:'upload',draft:sample,published:null,files:[descriptor]});}catch(error){fail(400,error.message);}
  const hash=createHash('sha256');for await(const chunk of fs.createReadStream(file.filepath))hash.update(chunk);
  if(hash.digest('hex')!==descriptor.sha256)fail(400,'L’empreinte du fichier reçu ne correspond pas.');
  let uploaded;
  try{return await locked(app,async()=>{
    const entry=store(app,'media-'+model.mediaKey(descriptor)),old=await entry.get();
    if(old&&await app.db.query('plugin::upload.file').findOne({where:{id:old.id}}))return {id:old.id,reused:true};
    const {name,alternativeText,caption,mime}=descriptor;
    const files=await app.plugin('upload').service('upload').upload({data:{fileInfo:{name,alternativeText,caption}},files:{...file,originalFilename:name,mimetype:mime}});
    uploaded=files[0];await entry.set({value:{id:uploaded.id}});return {id:uploaded.id,reused:false};
  });}catch(error){if(uploaded)await app.plugin('upload').service('upload').remove(uploaded).catch(()=>{});throw error;}
}
module.exports={exportPage,download,plan,publicPlan,importPublication,upload,instanceId,locked,store,mediaMapping,prepareMedia};
