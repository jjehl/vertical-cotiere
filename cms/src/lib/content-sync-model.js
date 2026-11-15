// Versioned API exchange format. No database IDs, users or storage credentials are imported.
const {createHash}=require('node:crypto');
const fields=['title','slug','body','category','date','meeting','legacyKey','legacyType','legacySlug','legacyBody','legacyHtml','legacySummary'];
const meetingFields=['start','end','allDay','location','participationUrl','participationLabel','deadline','eventState','calendarUid','tags'];
const categories=['Cours','Compétition','Sortie','Stage','Vie du club'];
// Only relative internal links; an external URL ending in /media/123 must stay external.
const mediaPattern=()=>/(?<![a-zA-Z0-9_:/.-])\/media\/(\d+)\b/g;
const canonical=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v);
const equal=(a,b)=>canonical(a)===canonical(b);
const digest=value=>createHash('sha256').update(typeof value==='string'?value:canonical(value)).digest('hex');
const mediaKey=file=>digest([file.sha256,file.name,file.mime,file.alternativeText||'',file.caption||'']);
function dataFromRow(row){
  if(!row)return null;
  const data=Object.fromEntries(fields.map(key=>[key,row[key]??null]));
  if(row.meeting)data.meeting=Object.fromEntries(meetingFields.map(key=>[key,row.meeting[key]??null]));
  return {...data,photos:(row.photos||[]).map(f=>String(f.id)),attachments:(row.attachments||[]).map(f=>String(f.id)),coverImage:row.coverImage?String(row.coverImage.id):null};
}
function validatePublication(value){
  const fail=message=>{throw new Error('Export invalide : '+message);};
  if(!value||value.version!==1||typeof value.sourceId!=='string'||!(/^[a-zA-Z0-9_-]{1,100}$/).test(value.sourceId)||
    typeof value.documentId!=='string'||!(/^[a-zA-Z0-9_-]{1,100}$/).test(value.documentId))fail('version ou identité');
  if(!Array.isArray(value.files)||value.files.length>5000)fail('fichiers');
  const seen=new Set();
  for(const file of value.files){
    if(!file||!(/^[1-9][0-9]*$/).test(file.id)||seen.has(file.id)||!(/^[a-f0-9]{64}$/).test(file.sha256))fail('identité ou empreinte de fichier');
    seen.add(file.id);
    for(const key of ['name','mime','alternativeText','caption'])if(typeof file[key]!=='string'||file[key].length>(key==='caption'?10000:1000))fail('métadonnées de fichier');
    if(!file.name||!file.mime)fail('nom ou type de fichier');
  }
  for(const [version,data] of Object.entries({draft:value.draft,published:value.published})){
    if(data===null&&version==='published')continue;
    if(!data||Object.keys(data).some(key=>![...fields,'photos','attachments','coverImage'].includes(key)))fail('champs de publication');
    if(typeof data.title!=='string'||!data.title.trim()||data.title.length>1000||typeof data.slug!=='string'||!(/^[a-zA-Z0-9_-]{1,200}$/).test(data.slug)||!categories.includes(data.category))fail('titre, slug ou catégorie');
    for(const key of fields.filter(k=>k!=='meeting'))if(data[key]!==null&&(typeof data[key]!=='string'||data[key].length>2000000))fail(key);
    if(data.date&&!Number.isFinite(Date.parse(data.date)))fail('date');
    if(data.legacyType!==null&&!['article','event','album'].includes(data.legacyType))fail('type historique');
    if(data.meeting!==null){
      if(typeof data.meeting!=='object'||Array.isArray(data.meeting)||Object.keys(data.meeting).some(key=>!meetingFields.includes(key)))fail('rendez-vous');
      for(const key of ['start','end','deadline'])if((key==='start'||data.meeting[key])&&!Number.isFinite(Date.parse(data.meeting[key])))fail('date du rendez-vous');
    }
    for(const key of ['photos','attachments'])if(!Array.isArray(data[key])||data[key].some(id=>!seen.has(id)))fail('référence de fichier');
    if(data.coverImage!==null&&!seen.has(data.coverImage))fail('couverture');
    for(const key of ['body','legacyBody','legacyHtml'])for(const match of (data[key]||'').matchAll(mediaPattern()))if(!seen.has(match[1]))fail('fichier intégré absent');
  }
  return value;
}
function mapData(data,mapping){
  if(!data)return null;
  const result={...data};
  for(const key of ['photos','attachments'])result[key]=data[key].map(id=>mapping.get(String(id)));
  result.coverImage=data.coverImage===null?null:mapping.get(String(data.coverImage));
  for(const key of ['body','legacyBody','legacyHtml'])if(result[key])result[key]=result[key].replace(mediaPattern(),(_,id)=>'/media/'+mapping.get(id));
  return result;
}
// Text/meeting fields use a three-way merge; media collections only gain entries.
function mergeVersion(incoming,sourceBase,current,targetBase,desired){
  if(!incoming)return {data:current,baseline:targetBase,conflicts:[]};
  if(!current)return {data:desired,baseline:desired,conflicts:targetBase?['état de publication']:[]};
  const data={...current},baseline={...(targetBase||current)},conflicts=[];
  for(const key of [...fields,'coverImage']){
    const changed=!sourceBase||!equal(incoming[key],sourceBase[key]);
    if(!changed)continue;
    if(targetBase&&!equal(current[key],targetBase[key])&&!equal(current[key],desired[key]))conflicts.push(key);
    else {data[key]=desired[key];baseline[key]=desired[key];}
  }
  for(const key of ['photos','attachments']){
    data[key]=[...new Set([...desired[key],...current[key]])];
    baseline[key]=data[key];
  }
  return {data,baseline,conflicts};
}
module.exports={fields,meetingFields,canonical,equal,digest,mediaKey,mediaPattern,dataFromRow,validatePublication,mapData,mergeVersion};
