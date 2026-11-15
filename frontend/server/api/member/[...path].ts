import type { MemberProfile } from '#shared/member';
import {resolveMediaUrl} from '../../utils/media-url';
const cookie='vc_member_session';
const methods:Record<string,Record<string,string>>={
  profile:{GET:'/api/member/me',PUT:'/api/member/profile'},password:{POST:'/api/member/password'},
  publications:{GET:'/api/member/publications'},photos:{POST:'/api/member/photos'},
  'assistant/status':{GET:'/api/member/assistant/status'},
  'assistant/prepare':{POST:'/api/member/assistant/prepare'},'assistant/confirm':{POST:'/api/member/assistant/confirm'},
};
export default defineEventHandler(async (event):Promise<unknown>=>{
  setHeader(event,'Cache-Control','private, no-store');
  setHeader(event,'Vary','Cookie');
  const path=getRouterParam(event,'path')||'';
  const method=event.method;
  if(!['GET','HEAD'].includes(method)) {
    const origin=getHeader(event,'origin');
    const url=getRequestURL(event);
    const protocol=(getHeader(event,'x-forwarded-proto')||url.protocol.replace(':','')).split(',')[0]?.trim();
    let same=false;
    try{const source=new URL(origin||'');same=source.host===url.host&&source.protocol===protocol+':';}catch{}
    if(!same)throw createError({statusCode:403,statusMessage:'Origine de la demande refusée.'});
  }
  const cms=useRuntimeConfig().cmsUrl;
  const saveSession=(jwt:string)=>setCookie(event,cookie,jwt,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge:8*3600});
  const clear=()=>deleteCookie(event,cookie,{path:'/'});
  if(path==='logout'&&method==='POST'){clear();return {ok:true};}
  try {
    if(path==='forgot-password'&&method==='POST') {
      const body=await readBody<Record<string,unknown>>(event);
      if(!body||typeof body.email!=='string'||Object.keys(body).some(key=>key!=='email')||body.email.length>254||!/^\S+@\S+\.\S+$/.test(body.email.trim()))throw createError({statusCode:400,statusMessage:'Adresse e-mail invalide.'});
      await $fetch(cms+'/api/auth/forgot-password',{method:'POST',body:{email:body.email.trim().toLowerCase()},timeout:20000});
      return {ok:true};
    }
    if(path==='reset-password'&&method==='POST') {
      const body=await readBody<Record<string,unknown>>(event);
      if(!body||Object.keys(body).some(key=>!['code','password','passwordConfirmation'].includes(key))||typeof body.code!=='string'||!(/^[a-f0-9]{128}$/).test(body.code))throw createError({statusCode:400,statusMessage:'Ce lien est invalide. Demandez un nouveau lien.'});
      if(typeof body.password!=='string'||body.password.length<12||Buffer.byteLength(body.password,'utf8')>72)throw createError({statusCode:400,statusMessage:'Choisissez au moins 12 caractères (72 octets maximum).'});
      if(body.password!==body.passwordConfirmation)throw createError({statusCode:400,statusMessage:'Les mots de passe ne correspondent pas.'});
      await $fetch(cms+'/api/auth/reset-password',{method:'POST',body:{code:body.code,password:body.password,passwordConfirmation:body.passwordConfirmation},timeout:15000});
      clear();return {ok:true};
    }
    if(['login','register'].includes(path)&&method==='POST') {
      const body=await readBody<Record<string,unknown>>(event);
      const allowed=path==='login'?['email','password']:['email','password','firstName','lastName'];
      if(!body||typeof body!=='object'||Object.keys(body).some(key=>!allowed.includes(key)))throw createError({statusCode:400,statusMessage:'Paramètres de connexion invalides.'});
      if(typeof body.email!=='string'||typeof body.password!=='string'||body.email.length>254||body.password.length>256)throw createError({statusCode:400,statusMessage:'Identifiants invalides.'});
      if(path==='register'&&['firstName','lastName'].some(key=>typeof body[key]!=='string'||!(body[key] as string).trim()||(body[key] as string).trim().length>80))throw createError({statusCode:400,statusMessage:'Prénom et nom sont requis (80 caractères maximum).'});
      const email=body.email.trim().toLowerCase();
      const response=await $fetch<{jwt?:string}>(cms+(path==='login'?'/api/auth/local':'/api/auth/local/register'),{
        method:'POST',body:path==='login'?{identifier:email,password:body.password}:{username:email,email,password:body.password,firstName:(body.firstName as string).trim(),lastName:(body.lastName as string).trim()},timeout:15000,
      });
      if(!response.jwt)return {requiresConfirmation:true};
      const profile=await $fetch<MemberProfile>(cms+'/api/member/me',{headers:{authorization:'Bearer '+response.jwt},timeout:10000});
      saveSession(response.jwt);
      return {profile};
    }
    const token=getCookie(event,cookie);
    if(!token)throw createError({statusCode:401,statusMessage:'Connexion requise.'});
    const photo=path.match(/^photos\/(\d+)$/);
    if(photo&&method==='GET') {
      const file=await $fetch<{name:string;mime:string;storageUrl:string}>(cms+'/api/member/photos/'+photo[1],{headers:{authorization:'Bearer '+token},timeout:10000});
      const config=useRuntimeConfig();
      const url=resolveMediaUrl(file.storageUrl,cms,config.mediaPublicBaseUrl,config.mediaInternalBaseUrl);
      const image=await fetch(url,{redirect:'error',signal:AbortSignal.timeout(30000)});
      if(!image.ok)throw createError({statusCode:404,statusMessage:'Photo indisponible.'});
      setHeader(event,'Content-Type',file.mime);setHeader(event,'X-Content-Type-Options','nosniff');
      return image.body?sendStream(event,image.body):'';
    }
    let target=methods[path]?.[method];
    const publication=path.match(/^assistant\/publications\/([a-zA-Z0-9_-]{1,100})$/);
    if(publication&&method==='GET')target='/api/member/assistant/publications/'+publication[1];
    if(!target)throw createError({statusCode:404,statusMessage:'Action introuvable.'});
    if(path==='photos') {
      if(Number(getHeader(event,'content-length')||0)>26*1024*1024)throw createError({statusCode:413,statusMessage:'Importer au maximum 25 Mo de photos à la fois.'});
      return proxyRequest(event,cms+target,{headers:{authorization:'Bearer '+token,cookie:''},fetchOptions:{redirect:'error'}});
    }
    const response:unknown=await $fetch<unknown>(cms+target,{method:method as 'GET'|'POST'|'PUT',headers:{authorization:'Bearer '+token},...(['POST','PUT'].includes(method)?{body:await readBody(event)}:{}),timeout:path==='assistant/prepare'?55000:15000});
    if(path==='password') {
      const result=response as {jwt?:string};if(result.jwt)saveSession(result.jwt);
      return {ok:true};
    }
    return response;
  }catch(error:unknown){
    const failure=error as {statusCode?:number;status?:number;data?:{error?:{message?:string}};statusMessage?:string};
    const status=failure.statusCode||failure.status||502;
    if(status===401)clear();
    const message=path==='forgot-password'&&status>=500?'L’envoi du lien est momentanément indisponible. Réessayez plus tard.':path==='login'&&[400,401,403].includes(status)?'Connexion impossible. Vérifiez votre e-mail et votre mot de passe.':failure.data?.error?.message||failure.statusMessage||(status>=500?'Le service membre est momentanément indisponible.':'La demande a été refusée.');
    throw createError({statusCode:status,statusMessage:message.slice(0,500)});
  }
});
