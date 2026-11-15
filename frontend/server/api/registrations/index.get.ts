import type {RegistrationCatalog} from '#shared/registration'
export default defineEventHandler(async event=>{
  setHeader(event,'Cache-Control','no-store');
  try{return await $fetch<RegistrationCatalog>(useRuntimeConfig().cmsUrl+'/api/registrations');}
  catch{throw createError({statusCode:503,statusMessage:'Le planning des inscriptions est momentanément indisponible.'});}
});
