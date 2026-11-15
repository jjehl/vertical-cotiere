const {digest,equal,mediaPattern}=require('./content-sync-model');
const definitions={
  documents:{uid:'api::club-document.club-document',model:'club-document',fields:['title','slug','category','description','legacyPath'],lists:[],singles:['file'],texts:['description'],populate:{file:true}},
  activities:{uid:'api::activity.activity',model:'activity',fields:['slug','title','eyebrow','summary','body','audience','tag','order'],lists:['attachments'],singles:['coverImage'],texts:['body','summary'],populate:{coverImage:true,attachments:true}},
  pages:{uid:'api::page.page',model:'page',fields:['slug','title','bodyHtml','group','oldPath','sourceId'],lists:['attachments'],singles:[],texts:['bodyHtml'],relations:['documents'],populate:{attachments:true,documents:true}},
  timetable:{uid:'api::club-timetable.club-timetable',model:'club-timetable',fields:['season','note','registrationsOpen','registrationOpensAt','sessions','ufraps'],lists:['attachments'],singles:[],texts:['note'],singleton:true,populate:{sessions:true,ufraps:{populate:{closures:true,closedDays:true}},attachments:true}},
};
const types=Object.keys(definitions);
const identity=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(value);
const slug=value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{1,200}$/.test(value);
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
const schema=type=>require('../api/'+definitions[type].model+'/content-types/'+definitions[type].model+'/schema.json');
const component=name=>require('../components/'+name.replace('.','/')+'.json');
const fail=message=>{throw Error('Contenu invalide : '+message);};
function scalar(value,attribute,path) {
  if(value===null){if(attribute.required)fail(path+' requis');return;}
  switch(attribute.type){
    case 'component': {
      const attrs=component(attribute.component).attributes;
      const rows=attribute.repeatable?value:[value];
      if(!Array.isArray(rows)||rows.length>1000)fail(path);
      for(const row of rows){if(!object(row)||Object.keys(row).some(key=>!Object.hasOwn(attrs,key)))fail(path+' : champs inconnus');for(const [key,attr] of Object.entries(attrs)){if(!Object.hasOwn(row,key))fail(path+'.'+key+' absent');scalar(row[key],attr,path+'.'+key);}}
      break;
    }
    case 'integer':if(!Number.isSafeInteger(value)||value<(attribute.min??-2147483648)||value>(attribute.max??2147483647))fail(path);break;
    case 'boolean':if(typeof value!=='boolean')fail(path);break;
    default:
      if(typeof value!=='string'||value.length>(attribute.type==='text'?2000000:1000)||attribute.required&&!value.trim())fail(path);
      if(attribute.type==='enumeration'&&!attribute.enum.includes(value))fail(path);
      if(attribute.type==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))fail(path);
      if(attribute.type==='datetime'&&!Number.isFinite(Date.parse(value)))fail(path);
      if(attribute.type==='time'&&!/^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?$/.test(value))fail(path);
  }
}
function pickComponent(value,attribute){
  if(value==null)return attribute.repeatable?[]:null;
  const pick=row=>Object.fromEntries(Object.entries(component(attribute.component).attributes).map(([key,attr])=>[key,attr.type==='component'?pickComponent(row[key],attr):row[key]??null]));
  return attribute.repeatable?value.map(pick):pick(value);
}
function dataFromRow(type,row){
  if(!row)return null;
  const config=definitions[type],attrs=schema(type).attributes;
  const result=Object.fromEntries(config.fields.map(key=>[key,attrs[key].type==='component'?pickComponent(row[key],attrs[key]):row[key]??null]));
  for(const key of config.lists)result[key]=(row[key]||[]).map(file=>String(file.id));
  for(const key of config.singles)result[key]=row[key]?String(row[key].id):null;
  for(const key of config.relations||[])result[key]=[...new Set((row[key]||[]).map(item=>item.documentId))];
  return result;
}
function validateContent(value,{dependency=false}={}) {
  if(!object(value)||value.version!==2||!types.includes(value.type)||!identity(value.sourceId)||!identity(value.documentId)||dependency&&value.type!=='documents')fail('type ou identité');
  if(Object.keys(value).some(key=>!['version','type','sourceId','documentId','draft','published','files','dependencies'].includes(key)))fail('champs de l’enveloppe');
  const config=definitions[value.type],attrs=schema(value.type).attributes;
  // Share the exact file metadata contract with the publication API.
  const files=value.files;
  const sample={title:'Fichier',slug:'fichier',category:'Vie du club',body:null,date:null,meeting:null,legacyKey:null,legacyType:null,legacySlug:null,legacyBody:null,legacyHtml:null,legacySummary:null,photos:[],attachments:[],coverImage:null};
  require('./content-sync-model').validatePublication({version:1,sourceId:value.sourceId,documentId:value.documentId,draft:sample,published:null,files});
  const ids=new Set(files.map(file=>file.id));
  const documentIds=new Set();
  for(const [version,data] of Object.entries({draft:value.draft,published:value.published})){
    if(data===null&&version==='published')continue;
    const keys=[...config.fields,...config.lists,...config.singles,...(config.relations||[])];
    if(!object(data)||Object.keys(data).length!==keys.length||Object.keys(data).some(key=>!keys.includes(key)))fail('champs de '+version);
    for(const key of config.fields)scalar(data[key],attrs[key],version+'.'+key);
    if(!config.singleton&&!slug(data.slug))fail('slug');
    for(const key of config.lists)if(!Array.isArray(data[key])||data[key].length>5000||new Set(data[key]).size!==data[key].length||data[key].some(id=>!ids.has(id)))fail('fichiers de '+key);
    for(const key of config.singles)if(data[key]!==null&&!ids.has(data[key])||data[key]===null&&attrs[key].required)fail('fichier '+key);
    for(const key of config.texts)for(const match of (data[key]||'').matchAll(mediaPattern()))if(!ids.has(match[1]))fail('fichier intégré absent');
    for(const key of config.relations||[]){if(!Array.isArray(data[key])||data[key].length>1000||new Set(data[key]).size!==data[key].length||!data[key].every(identity))fail('relation '+key);data[key].forEach(id=>documentIds.add(id));}
    if(value.type==='timetable')require('./schedule-validation').validateTimetable(data);
  }
  if(!Array.isArray(value.dependencies)||value.dependencies.length>1000||dependency&&value.dependencies.length||value.type!=='pages'&&value.dependencies.length)fail('dépendances');
  const related=new Set();
  for(const child of value.dependencies){validateContent(child,{dependency:true});if(child.sourceId!==value.sourceId||related.has(child.documentId))fail('identité de document lié');related.add(child.documentId);}
  if(documentIds.size!==related.size||[...documentIds].some(id=>!related.has(id)))fail('document lié absent');
  return value;
}
function mapData(type,data,media,references=new Map()) {
  if(!data)return null;
  const config=definitions[type],result=structuredClone(data);
  for(const key of config.lists)result[key]=data[key].map(id=>media.get(id));
  for(const key of config.singles)result[key]=data[key]===null?null:media.get(data[key]);
  for(const key of config.texts)if(result[key])result[key]=result[key].replace(mediaPattern(),(_,id)=>'/media/'+media.get(id));
  for(const key of config.relations||[])result[key]=data[key].map(id=>references.get(id));
  return result;
}
const slotIdentity=slot=>slot.registrationCode||digest([slot.label,slot.day,slot.start,slot.end,slot.audience]);
function mergeSlots(incoming,sourceBase,current,targetBase,desired){
  const maps=[sourceBase,current,targetBase,desired].map(rows=>new Map((rows||[]).map(slot=>[slotIdentity(slot),slot])));
  const [sourceRows,currentRows,targetRows,desiredRows]=maps,merged=[],conflicts=[];
  const baseline=new Map(targetRows);
  for(const item of incoming||[]){
    const code=slotIdentity(item),before=sourceRows.get(code),now=currentRows.get(code),targetBefore=targetRows.get(code),wanted=desiredRows.get(code);
    if(!now){if(targetBefore)conflicts.push('sessions.'+code);else{merged.push(wanted);baseline.set(code,wanted);}continue;}
    const result={...now},base={...(targetBefore||now)};
    for(const key of Object.keys(item)){
      if(before&&equal(item[key],before[key]))continue;
      if(targetBefore&&!equal(now[key],targetBefore[key])&&!equal(now[key],wanted[key]))conflicts.push('sessions.'+code+'.'+key);
      else{result[key]=wanted[key];base[key]=wanted[key];}
    }
    merged.push(result);baseline.set(code,base);
  }
  for(const [code,row] of currentRows)if(!merged.some(slot=>slotIdentity(slot)===code))merged.push(row);
  return {data:merged,baseline:merged.map(row=>baseline.get(slotIdentity(row))||row),conflicts};
}
function mergeVersion(type,incoming,sourceBase,current,targetBase,desired){
  if(!incoming)return {data:current,baseline:targetBase,conflicts:[]};
  if(!current)return {data:desired,baseline:desired,conflicts:targetBase?['état de publication']:[]};
  const config=definitions[type],data={...current},baseline={...(targetBase||current)},conflicts=[];
  for(const key of [...config.fields,...config.singles]){
    if(type==='timetable'&&key==='sessions'){
      const slots=mergeSlots(incoming.sessions,sourceBase?.sessions,current.sessions,targetBase?.sessions,desired.sessions);
      data.sessions=slots.data;baseline.sessions=slots.baseline;conflicts.push(...slots.conflicts);continue;
    }
    if(sourceBase&&equal(incoming[key],sourceBase[key]))continue;
    if(targetBase&&!equal(current[key],targetBase[key])&&!equal(current[key],desired[key]))conflicts.push(key);
    else{data[key]=desired[key];baseline[key]=desired[key];}
  }
  for(const key of [...config.lists,...(config.relations||[])]){data[key]=[...new Set([...desired[key],...current[key]])];baseline[key]=data[key];}
  return {data,baseline,conflicts};
}
const key=value=>'content-'+value.type+'-'+digest([value.sourceId,value.documentId]);
module.exports={definitions,types,dataFromRow,validateContent,mapData,mergeVersion,key};
