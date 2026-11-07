export default defineEventHandler(async event=>{
  const slug=getRouterParam(event,'slug')||'';
  const config=useRuntimeConfig();
  let file:{id:number};
  try {file=await $fetch(`${config.cmsUrl}/api/library/${encodeURIComponent(slug)}`,{timeout:10000});}
  catch {throw createError({statusCode:404,statusMessage:'Document introuvable'});}
  return proxyCmsFile(event,String(file.id));
});
