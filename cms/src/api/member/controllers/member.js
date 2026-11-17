const {errors}=require('@strapi/utils');
const {profile,validateProfile}=require('../../../lib/member-profile');
const uid='api::publication.publication';
const {memberTypes,canContribute}=require('../../../lib/member-roles');
function member(ctx,contributor=false) {
  const user=ctx.state.user;
  if(!user)ctx.throw(401,'Connexion requise.');
  if(user.blocked||!memberTypes.includes(user.role?.type))ctx.throw(403,'Accès membre refusé.');
  if(contributor&&!canContribute(user))ctx.throw(403,'Le rôle contributeur doit être attribué par un administrateur.');
  return user;
}
async function assistant(ctx,action) {
  member(ctx,true);ctx.state.memberMode=true;
  return strapi.plugin('publication-assistant').controller('assistant')[action](ctx);
}
async function uploadPhotos(ctx,user,publicationDocumentId=null) {
  const files=[ctx.request.files?.files].flat().filter(Boolean);
  if(!files.length||files.length>30)throw new errors.ValidationError('Sélectionner entre 1 et 30 photos.');
  if(files.reduce((total,file)=>total+file.size,0)>25*1024*1024)throw new errors.ValidationError('Importer au maximum 25 Mo de photos à la fois.');
  const sharp=require('sharp');const formats={jpeg:'image/jpeg',png:'image/png',webp:'image/webp',avif:'image/avif'};
  for(const file of files) {
    if(file.size>20*1024*1024)throw new errors.ValidationError('Une photo ne doit pas dépasser 20 Mo.');
    let metadata;try{metadata=await sharp(file.filepath,{limitInputPixels:40000000}).metadata();}catch{throw new errors.ValidationError('Photo invalide. Formats : JPEG, PNG, WebP ou AVIF.');}
    if(!formats[metadata.format]||!metadata.width||!metadata.height||metadata.width*metadata.height>40000000)throw new errors.ValidationError('Format ou dimensions de photo non pris en charge.');
    file.mimetype=formats[metadata.format];
  }
  const service=strapi.plugin('upload').service('upload');let uploaded=[];
  try {
    uploaded=await service.upload({data:{},files});
    for(const file of uploaded)await strapi.db.query('api::member-upload.member-upload').create({data:{owner:user.id,file:file.id,publicationDocumentId}});
    ctx.body=uploaded.map(({id,name,url})=>({id,name,url}));
  }catch(error){for(const file of uploaded)await service.remove(file).catch(()=>{});throw error;}
}
module.exports={
  async directory(ctx){member(ctx);return require('../../../lib/member-directory').list(strapi,ctx);},
  async memberDetails(ctx){member(ctx);return require('../../../lib/member-directory').details(strapi,ctx);},
  async participationPoll(ctx){return require('../../../lib/participation-polls').read(strapi,ctx,member(ctx));},
  async createParticipationPoll(ctx){return require('../../../lib/participation-polls').create(strapi,ctx,member(ctx,true));},
  async registerParticipation(ctx){return require('../../../lib/participation-polls').register(strapi,ctx,member(ctx));},
  async searchParticipationMembers(ctx){member(ctx);return require('../../../lib/participation-polls').searchMembers(strapi,ctx);},
  async me(ctx){ctx.set('Cache-Control','private, no-store');ctx.body=profile(member(ctx));},
  async updateProfile(ctx){
    const user=member(ctx);const data=validateProfile(ctx.request.body);
    const emailChanged=data.email&&data.email.toLowerCase()!==user.email.toLowerCase();
    const service=strapi.plugin('users-permissions').service('user');
    const updated=await service.edit(user.id,{...data,...(emailChanged?{confirmed:false}:{} )});
    if(emailChanged)await service.sendConfirmationEmail(updated);
    ctx.body=profile(updated);
  },
  async password(ctx){member(ctx);return strapi.plugin('users-permissions').controller('auth').changePassword(ctx);},
  async publications(ctx){
    const user=member(ctx,true);
    const rows=await strapi.documents(uid).findMany({status:'draft',filters:{memberAuthor:{id:user.id}},fields:['documentId','title','body','category','updatedAt'],sort:'updatedAt:desc',limit:200});
    const published=await strapi.documents(uid).findMany({status:'published',filters:{memberAuthor:{id:user.id}},fields:['documentId','slug'],limit:200});
    const urls=new Map(published.map(row=>[row.documentId,'/vie-du-club/'+encodeURIComponent(row.slug)]));
    ctx.body=rows.map(row=>({documentId:row.documentId,title:row.title,body:row.body||'',category:row.category,updatedAt:row.updatedAt,published:urls.has(row.documentId),url:urls.get(row.documentId)||null}));
  },
  async photo(ctx){
    const user=member(ctx,true);const id=Number(ctx.params.id);
    if(!Number.isSafeInteger(id)||id<1)ctx.throw(404,'Photo introuvable.');
    const own=await strapi.db.query('api::member-upload.member-upload').findOne({where:{owner:user.id,file:id}});
    const reference=own||await strapi.db.query(uid).findOne({where:{memberAuthor:user.id,photos:id}});
    if(!reference)ctx.throw(403,'Cette photo ne fait pas partie de vos publications.');
    const file=await strapi.db.query('plugin::upload.file').findOne({where:{id}});
    if(!file||!['image/jpeg','image/png','image/webp','image/avif','image/gif'].includes(file.mime))ctx.throw(404,'Photo introuvable.');
    ctx.body={id:file.id,name:file.name,mime:file.mime,storageUrl:file.url};
  },
  async photos(ctx){
    return uploadPhotos(ctx,member(ctx,true));
  },
  async publicationPhotos(ctx){
    const user=member(ctx,true);
    const publication=await strapi.documents(uid).findFirst({status:'published',filters:{slug:ctx.params.slug},fields:['documentId']});
    if(!publication)return ctx.notFound('Publication introuvable.');
    return uploadPhotos(ctx,user,publication.documentId);
  },
  async publicationPhotoIds(ctx){
    const user=member(ctx);
    const publication=await strapi.documents(uid).findFirst({status:'published',filters:{slug:ctx.params.slug},fields:['documentId'],populate:{memberAuthor:{fields:['id']}}});
    if(!publication)return ctx.notFound('Publication introuvable.');
    const uploads=await strapi.db.query('api::member-upload.member-upload').findMany({where:{owner:user.id,publicationDocumentId:publication.documentId},populate:{file:{select:['id']}}});
    ctx.body={ids:uploads.filter(upload=>upload.file).map(upload=>upload.file.id),canReorder:require('../../../lib/publication-photos').canReorderPhotos(user,publication)};
  },
  async reorderPublicationPhotos(ctx){return require('../../../lib/publication-photos').reorderPhotos(strapi,ctx,member(ctx,true));},
  async deletePublicationPhoto(ctx){
    const user=member(ctx);const id=Number(ctx.params.id);
    if(!Number.isSafeInteger(id)||id<1)return ctx.notFound('Photo introuvable.');
    const publication=await strapi.documents(uid).findFirst({status:'published',filters:{slug:ctx.params.slug},fields:['documentId']});
    if(!publication)return ctx.notFound('Publication introuvable.');
    const uploads=strapi.db.query('api::member-upload.member-upload');
    const upload=await uploads.findOne({where:{owner:user.id,file:id,publicationDocumentId:publication.documentId},populate:{file:true}});
    if(!upload?.file)return ctx.notFound('Photo introuvable.');
    await strapi.plugin('upload').service('upload').remove(upload.file);
    await uploads.delete({where:{id:upload.id}});
    ctx.body={ok:true};
  },
  assistantStatus:ctx=>assistant(ctx,'status'),assistantPublication:ctx=>assistant(ctx,'publication'),
  assistantPrepare:ctx=>assistant(ctx,'prepare'),assistantConfirm:ctx=>assistant(ctx,'confirm'),
};
