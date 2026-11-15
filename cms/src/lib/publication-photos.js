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
    return {...row,photos:[...editorial.map(file=>credits.has(file.id)?{...file,addedBy:credits.get(file.id)}:file),...community.filter(file=>!ids.has(file.id))]};
  });
}
module.exports={withCommunityPhotos};
