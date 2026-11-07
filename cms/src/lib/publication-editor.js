const crypto=require('node:crypto');
const {errors}=require('@strapi/utils');
const uid='api::publication.publication';
const slugify=value=>String(value||'publication').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,100)||'publication';

module.exports=async function publicationEditor(context,next,strapi) {
  if(context.uid!==uid||!['create','update','publish'].includes(context.action))return next();
  const previous=context.params.documentId?await strapi.documents(uid).findOne({documentId:context.params.documentId,populate:{meeting:true}}):null;
  const data=context.params.data||{};
  const merged={...previous,...data,meeting:data.meeting===null?null:data.meeting?{...previous?.meeting,...data.meeting}:previous?.meeting};
  const publishing=context.action==='publish'||context.params.status==='published';
  if(merged.meeting){
    const {start,end,deadline,participationUrl}=merged.meeting;
    if(start&&end&&new Date(end)<new Date(start))throw new errors.ValidationError('Le rendez-vous doit se terminer après son début.');
    if(start&&deadline&&new Date(deadline)>new Date(end||start))throw new errors.ValidationError('La clôture des inscriptions doit précéder la fin du rendez-vous.');
    if(participationUrl&&!/^https?:\/\//i.test(participationUrl))throw new errors.ValidationError('Le lien de participation doit commencer par https:// ou http://.');
    if(publishing&&!start)throw new errors.ValidationError('Indiquer le début du rendez-vous ou retirer le bloc agenda.');
  }
  const generated={};
  if(!merged.slug){
    let slug=slugify(merged.title);
    if(await strapi.documents(uid).findFirst({filters:{slug}}))slug+='-'+crypto.randomBytes(4).toString('hex');
    generated.slug=slug;
  }
  if(publishing&&!merged.date&&!merged.legacyKey)generated.date=new Date().toISOString();
  if(context.action==='publish'){
    if(Object.keys(generated).length)await strapi.documents(uid).update({documentId:context.params.documentId,data:generated});
  }else context.params.data={...data,...generated};
  return next();
};
