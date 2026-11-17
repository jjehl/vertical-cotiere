// Community photos are separate from editorial media so adding one never publishes a draft.
async function withCommunityPhotos(strapi,rows) {
  if(!rows.length)return rows;
  const uploads=await strapi.db.query('api::member-upload.member-upload').findMany({
    where:{publicationDocumentId:{$in:rows.map(row=>row.documentId)}},
    select:['publicationDocumentId'],populate:{file:true,owner:{select:['firstName','lastName']}},
    orderBy:[{createdAt:'asc'},{id:'asc'}],
  });
  const photos=new Map();
  for(const upload of uploads) {
    if(!upload.file)continue;
    const addedBy=[upload.owner?.firstName,upload.owner?.lastName].filter(Boolean).join(' ').trim()||'un membre';
    if(!photos.has(upload.publicationDocumentId))photos.set(upload.publicationDocumentId,[]);
    photos.get(upload.publicationDocumentId).push({...upload.file,addedBy});
  }
  return rows.map(row=>{
    const editorial=row.photos||[];const ids=new Set(editorial.map(file=>file.id));
    const community=photos.get(row.documentId)||[];const credits=new Map(community.map(file=>[file.id,file.addedBy]));
    const merged=[...editorial.map(file=>credits.has(file.id)?{...file,addedBy:credits.get(file.id)}:file),...community.filter(file=>!ids.has(file.id))];
    const positions=new Map((Array.isArray(row.photoOrder)?row.photoOrder:[]).map((id,index)=>[id,index]));
    // Deleted photos are ignored; new photos retain their natural order at the end.
    merged.sort((a,b)=>(positions.get(a.id)??Infinity)-(positions.get(b.id)??Infinity));
    return {...row,photos:merged};
  });
}
function canReorderPhotos(user,row) {
  return require('./member-roles').canContribute(user)&&
    (user.role.type==='member_admin'||row.memberAuthor?.id===user.id);
}
async function reorderPhotos(strapi,ctx,user) {
  const {ids,previousIds,...extra}=ctx.request.body||{};
  const valid=value=>Array.isArray(value)&&value.length<=10000&&value.every(id=>Number.isSafeInteger(id)&&id>0)&&new Set(value).size===value.length;
  if(Object.keys(extra).length||!valid(ids)||!valid(previousIds))ctx.throw(400,'Ordre des photos invalide.');
  const uid='api::publication.publication';
  const documents=strapi.documents(uid);
  const initial=await documents.findFirst({status:'published',filters:{slug:ctx.params.slug},populate:{memberAuthor:{fields:['id']}}});
  if(!initial)ctx.throw(404,'Publication introuvable.');
  if(!canReorderPhotos(user,initial))ctx.throw(403,'Seuls l’auteur de la publication et les administrateurs peuvent ordonner ses photos.');
  await strapi.db.transaction(async({trx})=>{
    const {tableName,attributes}=strapi.db.metadata.get(uid);
    await trx(tableName).where({[attributes.documentId.columnName]:initial.documentId}).forUpdate();
    const row=await documents.findOne({documentId:initial.documentId,status:'published',populate:{photos:true,memberAuthor:{fields:['id']}}});
    if(!row)ctx.throw(404,'Publication introuvable.');
    if(!canReorderPhotos(user,row))ctx.throw(403,'Vous ne pouvez plus ordonner ces photos.');
    const [current]=await withCommunityPhotos(strapi,[row]);
    const currentIds=current.photos.map(photo=>photo.id);
    if(JSON.stringify(previousIds)!==JSON.stringify(currentIds))ctx.throw(409,'Les photos ont changé. Rechargez la publication avant de les réordonner.');
    const allowed=new Set(currentIds);
    if(ids.length!==currentIds.length||ids.some(id=>!allowed.has(id)))ctx.throw(400,'Conservez toutes les photos de cette publication dans le nouvel ordre.');
    // Update ordering in both versions without publishing or changing editorial fields.
    await strapi.db.query(uid).updateMany({where:{documentId:row.documentId},data:{photoOrder:ids}});
  });
  ctx.body={ids};
}
module.exports={withCommunityPhotos,canReorderPhotos,reorderPhotos};
