import type {Publication} from '#shared/types';
export default defineEventHandler(async event=>{
  const slug=getRouterParam(event,'slug')||'';
  const config=useRuntimeConfig();
  try{
    const publication=await $fetch<Publication>(`${config.cmsUrl}/api/publications/${encodeURIComponent(slug)}`,{timeout:10000});
    publication.bodyHtml=cleanImportedHtml(publication.bodyHtml||'');
    return publication;
  }catch(error){
    const status=(error as {response?:{status?:number}}).response?.status;
    throw createError({statusCode:status===404?404:503,statusMessage:status===404?'Publication introuvable':'Publication momentanément indisponible'});
  }
});
