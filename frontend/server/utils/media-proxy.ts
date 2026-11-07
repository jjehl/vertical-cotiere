import type { H3Event } from 'h3';
interface CmsFile { id:number; name:string; mime:string; storageUrl:string }

export async function proxyCmsFile(event:H3Event, id:string, thumbnail=false) {
  if(!/^\d+$/.test(id)) throw createError({statusCode:404,statusMessage:'Fichier introuvable'});
  const config=useRuntimeConfig();
  let file:CmsFile;
  try { file=await $fetch<CmsFile>(`${config.cmsUrl}/api/site-files/${id}`,{query:thumbnail?{variant:'thumbnail'}:{},timeout:10000}); }
  catch { throw createError({statusCode:404,statusMessage:'Fichier introuvable'}); }
  if(!/^\/uploads\/[a-zA-Z0-9_.-]+$/.test(file.storageUrl)) throw createError({statusCode:502,statusMessage:'Adresse de fichier invalide'});
  const range=getHeader(event,'range');
  const response=await fetch(config.cmsUrl+file.storageUrl,{method:event.method==='HEAD'?'HEAD':'GET',headers:range?{range}:{},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw createError({statusCode:response.status===404?404:502,statusMessage:'Fichier indisponible'});
  setResponseStatus(event,response.status);
  for(const header of ['content-type','content-length','content-range','accept-ranges']) {
    const value=response.headers.get(header);if(value)setHeader(event,header,value);
  }
  setHeader(event,'Cache-Control','no-cache');
  setHeader(event,'Content-Disposition',`inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);
  return response.body?sendStream(event,response.body):'';
}
