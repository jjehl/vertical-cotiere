export default defineEventHandler(async event=>{
  const config=useRuntimeConfig();
  try{return await $fetch<{url:string}>(`${config.cmsUrl}/api/publication-link`,{query:{path:String(getQuery(event).path||'')},timeout:10000});}
  catch(error){throw createError({statusCode:(error as {response?:{status?:number}}).response?.status===404?404:503,statusMessage:'Publication introuvable'});}
});
