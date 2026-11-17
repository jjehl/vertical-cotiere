const {fields:profileFields}=require('./member-profile');
const {memberTypes}=require('./member-roles');
const {digest,equal}=require('./content-sync-model');
const fields=['username','email',...Object.keys(profileFields),'membershipBirthDate','role','confirmed','blocked','passwordHash'];
const object=value=>value&&typeof value==='object'&&!Array.isArray(value);
function dataFromRow(row){
  return {username:row.username,email:row.email,...Object.fromEntries(Object.keys(profileFields).map(key=>[key,row[key]??null])),membershipBirthDate:row.membershipBirthDate??null,role:row.role?.type,confirmed:row.confirmed===true,blocked:row.blocked===true,passwordHash:row.password||null};
}
function validateContent(value){
  const fail=field=>{const error=Error('Membre invalide : '+field);error.status=400;throw error;};
  if(!object(value)||value.version!==2||value.type!=='members'||Object.keys(value).some(key=>!['version','type','sourceId','documentId','draft','published','files','dependencies'].includes(key)))fail('enveloppe');
  for(const key of ['sourceId','documentId'])if(typeof value[key]!=='string'||!(/^[a-zA-Z0-9_-]{1,100}$/).test(value[key]))fail('identité');
  if(value.published!==null||!Array.isArray(value.files)||value.files.length||!Array.isArray(value.dependencies)||value.dependencies.length)fail('relations');
  const data=value.draft;
  if(!object(data)||Object.keys(data).length!==fields.length||Object.keys(data).some(key=>!fields.includes(key)))fail('champs');
  if(typeof data.username!=='string'||data.username.length<3||data.username.length>254||/\s/.test(data.username))fail('identifiant');
  if(typeof data.email!=='string'||data.email.length>254||!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).test(data.email)||data.email!==data.email.trim().toLowerCase())fail('e-mail');
  for(const [key,max] of Object.entries(profileFields))if(data[key]!==null&&(typeof data[key]!=='string'||data[key].length>max))fail(key);
  if(data.membershipBirthDate!==null&&(!(/^\d{4}-\d{2}-\d{2}$/).test(data.membershipBirthDate)||!Number.isFinite(Date.parse(data.membershipBirthDate))||new Date(data.membershipBirthDate).toISOString().slice(0,10)!==data.membershipBirthDate))fail('date de naissance');
  if(!memberTypes.includes(data.role)||typeof data.confirmed!=='boolean'||typeof data.blocked!=='boolean')fail('rôle ou état');
  // Only bcrypt hashes produced by supported Strapi installations, never plaintext.
  if(data.passwordHash!==null&&(typeof data.passwordHash!=='string'||!(/^\$2[aby]\$(0[4-9]|1[0-4])\$[./A-Za-z0-9]{53}$/).test(data.passwordHash)))fail('empreinte du mot de passe');
  return value;
}
// Keep only a fingerprint of the password hash in the merge history.
const snapshot=data=>({...data,passwordHash:data.passwordHash===null?null:digest(data.passwordHash)});
function merge(incoming,sourceBase,current,targetBase){
  if(!current)return {data:structuredClone(incoming),baseline:snapshot(incoming),conflicts:[]};
  const source=snapshot(incoming),target=snapshot(current),data={...current},baseline={...(targetBase||target)},conflicts=[];
  for(const key of fields){
    if(sourceBase&&equal(source[key],sourceBase[key]))continue;
    if(targetBase&&!equal(target[key],targetBase[key])&&!equal(target[key],source[key]))conflicts.push(key);
    else{data[key]=incoming[key];baseline[key]=source[key];}
  }
  return {data,baseline,conflicts};
}
const key=content=>'member-'+digest([content.sourceId,content.documentId]);
module.exports={fields,dataFromRow,validateContent,snapshot,merge,key};
