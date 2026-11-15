export default defineEventHandler(async event=>{
  setHeader(event,'Cache-Control','private, no-store');
  const action=getRouterParam(event,'action');
  if(!['checkout','status','activate'].includes(action||''))throw createError({statusCode:404});
  setHeader(event,'Vary','Cookie');
  const url=getRequestURL(event);
  const protocol=(getHeader(event,'x-forwarded-proto')||url.protocol.replace(':','')).split(',')[0]?.trim();
  let same=false;
  try{const origin=new URL(getHeader(event,'origin')||'');same=origin.host===url.host&&origin.protocol===protocol+':';}catch{}
  if(!same)throw createError({statusCode:403,statusMessage:'Origine de la demande refusée.'});
  const token=getCookie(event,'vc_member_session');
  if(action!=='activate'&&!token)throw createError({statusCode:401,data:{message:'Connectez-vous pour inscrire un adhérent.'}});
  const input=action!=='status'?await readBody<Record<string,unknown>>(event):{};
  // The authenticated CMS derives payer identity. No payer or price comes from the form.
  const body:Record<string,unknown>={};
  const allowed=action==='activate'?['code','password','passwordConfirmation']:['slotCode','firstName','lastName','birthDate','email','address','promoCode','familyReference','accepted','participantMode'];
  for(const key of allowed)if(input?.[key]!==undefined)body[key]=input[key];
  try{return await $fetch(useRuntimeConfig().cmsUrl+'/api/registrations/'+action,{method:'POST',body,...(action!=='activate'?{headers:{authorization:'Bearer '+token}}:{}),timeout:55000});}
  catch(error:unknown){
    const failure=error as {statusCode?:number;data?:{error?:{message?:string}}};
    throw createError({statusCode:failure.statusCode||503,data:{message:failure.data?.error?.message||'Le suivi des inscriptions est momentanément indisponible.'}});
  }
});
