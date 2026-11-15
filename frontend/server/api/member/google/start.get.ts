import {randomBytes,createHash} from 'node:crypto';
import {memberReturnPath} from '#shared/member-google';
import {saveMemberCookie,clearGoogleCookies,googleFlowCookie} from '../../../utils/member-session';
export default defineEventHandler(async event=>{
  setHeader(event,'Cache-Control','private, no-store');setHeader(event,'Referrer-Policy','no-referrer');
  clearGoogleCookies(event);
  const state=randomBytes(32).toString('base64url');const nonce=randomBytes(32).toString('base64url');const codeVerifier=randomBytes(32).toString('base64url');
  const returnPath=memberReturnPath(getQuery(event).retour);
  try {
    const result=await $fetch<{url:string}>(useRuntimeConfig().cmsUrl+'/api/auth/google/start',{method:'POST',body:{state,nonce,codeChallenge:createHash('sha256').update(codeVerifier).digest('base64url')},timeout:10000});
    saveMemberCookie(event,googleFlowCookie,JSON.stringify({state,nonce,codeVerifier,returnPath,expires:Date.now()+600000}),600);
    return sendRedirect(event,result.url,302);
  }catch{return sendRedirect(event,'/connexion?google=indisponible',302);}
});
