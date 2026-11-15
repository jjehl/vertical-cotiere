const {errors}=require('@strapi/utils');
const {profile,validateProfile}=require('../../../lib/member-profile');
const uid='api::publication.publication';
function member(ctx,contributor=false) {
  const user=ctx.state.user;
  if(!user)ctx.throw(401,'Connexion requise.');
  if(user.blocked||!['authenticated','contributor'].includes(user.role?.type))ctx.throw(403,'Accès membre refusé.');
  if(contributor&&user.role.type!=='contributor')ctx.throw(403,'Le rôle contributeur doit être attribué par un administrateur.');
  return user;
}
async function assistant(ctx,action) {
  member(ctx,true);ctx.state.memberMode=true;
  return strapi.plugin('publication-assistant').controller('assistant')[action](ctx);
}
module.exports={
  async me(ctx){ctx.set('Cache-Control','private, no-store');ctx.body=profile(member(ctx));},
  async updateProfile(ctx){
    const user=member(ctx);const data=validateProfile(ctx.request.body);
    if(data.email&&data.email!==user.email) {
      const duplicate=await strapi.db.query('plugin::users-permissions.user').findOne({where:{id:{$ne:user.id},$or:[{email:data.email},{username:data.email}]}});
      if(duplicate)throw new errors.ValidationError('Cette adresse e-mail est déjà utilisée.');
      data.username=data.email;
    }
    try{ctx.body=profile(await strapi.plugin('users-permissions').service('user').edit(user.id,data));}
    catch(error){if(error.code==='23505'||error.cause?.code==='23505')throw new errors.ValidationError('Cette adresse e-mail est déjà utilisée.');throw error;}
  },
  async password(ctx){member(ctx);return strapi.plugin('users-permissions').controller('auth').changePassword(ctx);},
  async publications(ctx){
    const user=member(ctx,true);
    const rows=await strapi.documents(uid).findMany({status:'draft',filters:{memberAuthor:{id:user.id}},fields:['documentId','title','updatedAt'],sort:'updatedAt:desc',limit:200});
    const published=await strapi.documents(uid).findMany({status:'published',filters:{memberAuthor:{id:user.id}},fields:['documentId'],limit:200});
    const ids=new Set(published.map(row=>row.documentId));
    ctx.body=rows.map(row=>({documentId:row.documentId,title:row.title,updatedAt:row.updatedAt,published:ids.has(row.documentId)}));
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
    const user=member(ctx,true);const files=[ctx.request.files?.files].flat().filter(Boolean);
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
      for(const file of uploaded)await strapi.db.query('api::member-upload.member-upload').create({data:{owner:user.id,file:file.id}});
      ctx.body=uploaded.map(({id,name,url})=>({id,name,url}));
    }catch(error){for(const file of uploaded)await service.remove(file).catch(()=>{});throw error;}
  },
  assistantStatus:ctx=>assistant(ctx,'status'),assistantPublication:ctx=>assistant(ctx,'publication'),
  assistantPrepare:ctx=>assistant(ctx,'prepare'),assistantConfirm:ctx=>assistant(ctx,'confirm'),
};
