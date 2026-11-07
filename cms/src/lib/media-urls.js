let mediaIndex;
async function getMediaIndex(strapi) {
  if(!mediaIndex)mediaIndex=await strapi.store({type:'core',name:'vertical-admin',key:'media-v1'}).get()||{photos:{},assets:{}};
  return mediaIndex;
}
const mediaUrl = file => file?'/media/'+file.id:'';
const mediaDto = file => file?{id:file.id,name:file.name,url:mediaUrl(file),mime:file.mime,width:file.width,height:file.height}:null;
const documentDto = row => ({title:row.title,slug:row.slug,category:row.category,description:row.description,format:row.file?.ext?.slice(1).toUpperCase(),url:'/document-files/'+row.slug});
const imagePosition = file => {
  const point=file?.focalPoint;
  return point&&Number.isFinite(point.x)&&Number.isFinite(point.y)?`${Math.max(0,Math.min(100,point.x))}% ${Math.max(0,Math.min(100,point.y))}%`:'50% 50%';
};
module.exports={getMediaIndex,mediaUrl,mediaDto,documentDto,imagePosition};
