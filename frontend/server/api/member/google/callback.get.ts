import type {MemberProfile} from '#shared/member';
import {readGoogleFlow} from '../../../utils/member-google';
import {saveMemberCookie,clearGoogleCookies,googleFlowCookie,googlePendingCookie,memberCookie} from '../../../utils/member-session';
export default defineEventHandler(async event=>{
  setHeader(event,'Cache-Control','private, no-store');setHeader(event,'Referrer-Policy','no-referrer');
  const query=getQuery(event);const flow=readGoogleFlow(getCookie(event,googleFlowCookie),query.state);
  clearGoogleCookies(event);
  if(!flow)return sendRedirect(event,'/connexion?google=expire',302);
  if(query.error)return sendRedirect(event,'/connexion?google=annule',302);
  if(typeof query.code!=='string'||!query.code||query.code.length>4096)return sendRedirect(event,'/connexion?google=erreur',302);
  try {
    const cms=useRuntimeConfig().cmsUrl;
    const result=await $fetch<{jwt?:string;requiresLink?:boolean;pendingToken?:string}>(cms+'/api/auth/google/callback',{method:'POST',body:{code:query.code,nonce:flow.nonce,codeVerifier:flow.codeVerifier},timeout:25000});
    if(result.requiresLink&&result.pendingToken) {
      saveMemberCookie(event,googlePendingCookie,result.pendingToken,600);
      return sendRedirect(event,'/connexion?google=lier&retour='+encodeURIComponent(flow.returnPath),302);
    }
    if(!result.jwt)throw new Error('Missing session');
    await $fetch<MemberProfile>(cms+'/api/member/me',{headers:{authorization:'Bearer '+result.jwt},timeout:10000});
    saveMemberCookie(event,memberCookie,result.jwt,8*3600);
    return sendRedirect(event,flow.returnPath,302);
  }catch{return sendRedirect(event,'/connexion?google=erreur',302);}
});
