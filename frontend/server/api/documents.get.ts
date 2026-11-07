import type { ClubDocument } from '#shared/types';
export default defineEventHandler(async()=>{
  const config=useRuntimeConfig();
  try{return await $fetch<ClubDocument[]>(`${config.cmsUrl}/api/library`,{timeout:10000});}
  catch{throw createError({statusCode:503,statusMessage:'Les documents sont momentanément indisponibles'});}
});
