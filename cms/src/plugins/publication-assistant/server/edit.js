const {createHash}=require('node:crypto');
const uid='api::publication.publication';
const populate={meeting:true,photos:true,attachments:true,coverImage:true,createdBy:true,updatedBy:true,memberAuthor:true};
const meetingFields=['start','end','location','participationUrl','participationLabel','deadline','allDay','eventState'];
const local=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function fail(message,status){const error=new Error(message);error.status=status;throw error;}
function editorialData(row) {
  return {title:row.title,body:row.body||'',category:row.category||'Vie du club',
    meeting:row.meeting?Object.fromEntries(meetingFields.map(key=>[key,row.meeting[key]??null])):null};
}
function canonical(value) {
  if(Array.isArray(value))return value.map(canonical);
  if(value instanceof Date)return value.toISOString();
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
  return value;
}
async function loadEditable(strapi,check,documentId) {
  if(typeof documentId!=='string'||!documentId||documentId.length>100)fail('Publication invalide.',400);
  if(check.cannot.read()||check.cannot.update())fail('Les droits de lecture et de modification sont nécessaires.',403);
  const [draft,published]=await Promise.all(['draft','published'].map(status=>strapi.documents(uid).findOne({documentId,status,populate})));
  // Editing always starts from the saved draft, including any unpublished work.
  if(!draft)fail('Cette publication est introuvable.',404);
  if(check.cannot.read(draft)||check.cannot.update(draft))fail('Vous ne pouvez pas modifier cette publication.',403);
  const data=editorialData(draft);
  const readable=await check.sanitizeOutput(draft);
  if(!contains(data,editorialData(readable)))fail('Vos droits ne permettent pas de lire tous les champs nécessaires à l’assistant.',403);
  const version=createHash('sha256').update(JSON.stringify(canonical({draft,published}))).digest('hex');
  return {draft,published,data,version,photos:readable.photos||[]};
}
function contains(a,b) {
  return Object.entries(a).every(([key,value])=>value&&typeof value==='object'&&!Array.isArray(value)
    ? b?.[key]&&contains(value,b[key]) : JSON.stringify(value)===JSON.stringify(b?.[key]));
}
async function permittedUpdate(check,source,data,user) {
  const clean=await check.sanitizeUpdateInput(source)(data);
  if(!contains(data,clean)||check.cannot.update({...source,...clean}))fail('Vos droits Strapi ne permettent pas de modifier tous ces champs.',403);
  const {setCreatorFields}=require('@strapi/utils');
  return check.isMember?clean:setCreatorFields({user,isEdition:true})(clean);
}
function modelContext(data) {
  const context=structuredClone(data);
  if(context.meeting)for(const key of ['start','end','deadline']) {
    const value=context.meeting[key];
    if(value)context.meeting[key]=(key!=='deadline'&&context.meeting.allDay)
      ? new Date(value).toISOString().slice(0,10)+'T00:00' : local.format(new Date(value)).replace(' ','T');
  }
  return context;
}
function updateData(proposal) {
  // Explicit nulls clear optional values instead of leaving old component values.
  return {...proposal,meeting:proposal.meeting?Object.fromEntries(meetingFields.map(key=>[key,proposal.meeting[key]??null])):null};
}
function retainMeetingMetadata(data,source) {
  if(!data.meeting||!source.meeting)return data;
  return {...data,meeting:{...Object.fromEntries(['id','calendarUid','tags'].filter(key=>source.meeting[key]!==undefined).map(key=>[key,source.meeting[key]])),...data.meeting}};
}
module.exports={loadEditable,permittedUpdate,modelContext,updateData,retainMeetingMetadata};
