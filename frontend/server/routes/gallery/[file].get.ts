export default defineEventHandler(async event=>{
  const match=(getRouterParam(event,'file')||'').match(/^(\d+)-(original|thumb)\.(?:jpe?g|png|gif|webp)$/i);
  if(!match)throw createError({statusCode:404,statusMessage:'Photo introuvable'});
  const config=useRuntimeConfig();
  let file:{url:string};
  try{file=await $fetch(`${config.cmsUrl}/api/gallery-files/${match[1]}`,{query:{variant:match[2]},timeout:10000});}
  catch{throw createError({statusCode:404,statusMessage:'Photo introuvable'});}
  return sendRedirect(event,file.url,302);
});
