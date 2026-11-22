const {errors}=require('@strapi/utils');
const fields={firstName:80,lastName:80,phone:40,street:250,postalCode:20,city:120,country:100,ffmeLicenseNumber:40};
const validityDates={
  ffmeLicenseValidUntil:'Fin de validité de la licence FFME',
  clubMembershipValidUntil:'Fin de validité de la cotisation club',
};
const memberDateFields=['membershipBirthDate',...Object.keys(validityDates)];
function profile(user) {
  return {id:user.id,username:user.username,email:user.email,emailConfirmed:user.confirmed===true,hasPassword:Boolean(user.password),googleConnected:Boolean(user.googleSubject),...Object.fromEntries(Object.keys(fields).map(key=>[key,user[key]||''])),role:user.role?.type==='member_admin'?'admin':user.role?.type==='contributor'?'contributor':'basic'};
}
function validateProfile(input) {
  if(!input||typeof input!=='object'||Array.isArray(input))throw new errors.ValidationError('Profil invalide.');
  if(Object.keys(input).some(key=>!Object.hasOwn(fields,key)&&key!=='email'))throw new errors.ValidationError('Seules les informations du profil peuvent être modifiées.');
  const result={};
  for(const [key,value] of Object.entries(input)) {
    const max=key==='email'?254:fields[key];
    if(typeof value!=='string'||value.trim().length>max)throw new errors.ValidationError('Un champ du profil est invalide ou trop long.');
    result[key]=value.trim();
    if(['firstName','lastName','email'].includes(key)&&!result[key])throw new errors.ValidationError('Prénom, nom et e-mail sont requis.');
  }
  if(result.email) {
    result.email=result.email.toLowerCase();
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email))throw new errors.ValidationError('Adresse e-mail invalide.');
  }
  return result;
}
module.exports={fields,validityDates,memberDateFields,profile,validateProfile};
