const model=require('./content-sync-site-model');
const common=require('./content-sync-service');
const {equal,digest}=require('./content-sync-model');
const {store,locked}=common;
const fail=(status,message)=>{const error=Error(message);error.status=status;throw error;};
async function versions(app,type,documentId){
  const config=model.definitions[type];
  return Object.fromEntries(await Promise.all(['draft','published'].map(async status=>[status,model.dataFromRow(type,await app.documents(config.uid).findOne({documentId,status,populate:config.populate}))])));
}
async function exportDocument(app,type,documentId,sourceId){
  const config=model.definitions[type],data=await versions(app,type,documentId);
  if(!data.draft)fail(422,'Brouillon du contenu lié introuvable : '+documentId);
  const files=await common.prepareMedia(app,data,config),dependencies=[];
  if(type==='pages')for(const related of new Set([...data.draft.documents,...(data.published?.documents||[])]))dependencies.push(await exportDocument(app,'documents',related,sourceId));
  return {version:2,type,sourceId,documentId,...data,files,dependencies};
}
async function exportPage(app,{type,page=1,pageSize=10,slug}){
  const config=model.definitions[type];if(!config)fail(400,'Type de contenu non synchronisable.');
  const sourceId=await common.instanceId(app),docs=app.documents(config.uid);
  const filters=config.singleton?{}:slug?{slug}:{};
  const total=config.singleton&&slug&&slug!=='club-timetable'?0:await docs.count({status:'draft',filters});
  const rows=total?await docs.findMany({status:'draft',filters,sort:'documentId:asc',start:(page-1)*pageSize,limit:pageSize,fields:['documentId']}):[];
  const contents=[];for(const row of rows)contents.push(await exportDocument(app,type,row.documentId,sourceId));
  return {version:2,type,sourceId,contents,pagination:{page,pageSize,total,pageCount:Math.ceil(total/pageSize)}};
}
async function referenceMapping(app,content){
  const mapping=new Map(),symbolic=new Map(),missing=[];
  for(const document of content.dependencies){
    const reference=model.key(document),record=await store(app,reference).get();
    const exists=record&&await app.documents(model.definitions.documents.uid).findOne({documentId:record.documentId});
    symbolic.set(document.documentId,reference);
    if(exists)mapping.set(document.documentId,record.documentId);
    else{mapping.set(document.documentId,'pending-'+digest(reference));missing.push(document.documentId);}
  }
  return {mapping,symbolic,missing};
}
async function registrationConflicts(app,data,current){
  if(!data)return [];
  const rows=await app.db.query('api::course-registration.course-registration').findMany({where:{registrationStatus:{$in:['creating','pending','confirmed']}},select:['season','slotCode','registrationStatus']});
  const conflicts=[];
  if(current&&data.season!==current.season&&rows.some(row=>row.season===current.season&&['creating','pending'].includes(row.registrationStatus)))conflicts.push('season : paiements en cours sur la saison cible');
  const counts=new Map();for(const row of rows)if(row.season===data.season)counts.set(row.slotCode,(counts.get(row.slotCode)||0)+1);
  for(const [code,count] of counts){
    const slot=data.sessions.find(slot=>require('./course-registrations').slotCode(slot)===code);
    if(!slot||slot.capacity==null||slot.capacity<count+(slot.occupiedPlaces||0))conflicts.push('sessions.'+code+' : capacité insuffisante pour les inscriptions de la cible');
  }
  return conflicts;
}
async function plan(app,content,{adoptSlug=false,trx}={}){
  try{model.validateContent(content);}catch(error){fail(400,error.message);}
  if(content.sourceId===await store(app,'instance').get())fail(400,'La source et la destination sont la même instance.');
  const config=model.definitions[content.type],key=model.key(content),record=await store(app,key).get();
  const docs=app.documents(config.uid);let documentId=record?.documentId;
  if(documentId&&!await docs.findOne({documentId}))return {action:'conflict',conflicts:['Contenu supprimé en destination.'],key};
  const filters=config.singleton?{}:{slug:{$in:[...new Set([content.draft.slug,content.published?.slug].filter(Boolean))]}};
  const matches=[...new Map((await Promise.all(['draft','published'].map(status=>docs.findMany({status,filters,fields:['documentId'],limit:3})))).flat().map(row=>[row.documentId,row])).values()];
  const others=matches.filter(row=>row.documentId!==documentId);
  if(others.length){
    if(!documentId&&adoptSlug&&others.length===1)documentId=others[0].documentId;
    else return {action:'conflict',conflicts:[(config.singleton?'Planning déjà présent':'Slug déjà utilisé : '+content.draft.slug)+' (rapprochement explicite requis).'],key};
  }
  if(trx&&documentId){const metadata=app.db.metadata.get(config.uid);await trx(metadata.tableName).where(metadata.attributes.documentId.columnName,documentId).forUpdate();}
  const current=documentId?await versions(app,content.type,documentId):{draft:null,published:null};
  const media=await common.mediaMapping(app,content),references=await referenceMapping(app,content);
  const incoming={},desired={},merged={},baseline={},conflicts=[...media.conflicts];
  for(const version of ['draft','published']){
    incoming[version]=model.mapData(content.type,content[version],media.symbolic,references.symbolic);
    desired[version]=model.mapData(content.type,content[version],media.mapping,references.mapping);
    const result=model.mergeVersion(content.type,incoming[version],record?.source?.[version],current[version],record?.target?.[version],desired[version]);
    merged[version]=result.data;baseline[version]=result.baseline;conflicts.push(...result.conflicts.map(field=>version+'.'+field));
  }
  if(content.type==='timetable'){
    // Use the reservation lock during import, so checkout cannot race a capacity update.
    if(trx)await trx.raw('SELECT pg_advisory_xact_lock(2672027)');
    for(const version of ['draft','published'])if(merged[version])try{require('./schedule-validation').validateTimetable(merged[version]);}catch(error){conflicts.push(version+'.'+error.message);}
    conflicts.push(...(await registrationConflicts(app,merged.published,current.published)).map(field=>'published.'+field));
  }
  if(conflicts.length)return {action:'conflict',conflicts,key,documentId};
  const action=!documentId?'create':equal(current,merged)&&!media.missing.length?'unchanged':'update';
  return {action,key,documentId,incoming,merged,baseline,current,missingFiles:action==='unchanged'?[]:media.missing,missingReferences:references.missing,adopted:!record&&Boolean(documentId)};
}
const publicPlan=result=>({...common.publicPlan(result),missingReferences:result.missingReferences||[]});
async function importContent(app,content,options){
  return locked(app,async trx=>{
    const result=await plan(app,content,{...options,trx});if(result.action==='conflict')return publicPlan(result);
    if(result.missingFiles.length||result.missingReferences.length)fail(409,'Transférer les fichiers et documents liés avant le contenu.');
    const config=model.definitions[content.type],docs=app.documents(config.uid);let documentId=result.documentId;
    const writeData=data=>{
      const output=structuredClone(data);
      for(const key of config.lists)output[key]=data[key].map(Number);
      for(const key of config.singles)output[key]=data[key]===null?null:Number(data[key]);
      for(const key of config.relations||[])output[key]={set:data[key]};
      return output;
    };
    if(result.action!=='unchanged'){
      const first=result.merged.published||result.merged.draft;
      if(!documentId){const created=await docs.create({data:writeData(first),...(result.merged.published?{status:'published'}:{})});documentId=created.documentId;}
      else if(result.merged.published&&!equal(result.current.published,result.merged.published))await docs.update({documentId,data:writeData(result.merged.published),status:'published'});
      if(!equal(result.merged.draft,first)||result.documentId)await docs.update({documentId,data:writeData(result.merged.draft)});
    }
    await store(app,result.key).set({value:{documentId,source:result.incoming,target:result.baseline}});
    return {...publicPlan(result),documentId};
  });
}
module.exports={exportPage,plan,publicPlan,importContent};
