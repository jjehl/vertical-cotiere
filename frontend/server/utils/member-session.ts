import type {H3Event} from 'h3';
import {setCookie,deleteCookie} from 'h3';
export const memberCookie='vc_member_session';
export const googleFlowCookie='vc_google_flow';
export const googlePendingCookie='vc_google_pending';
export function saveMemberCookie(event:H3Event,name:string,value:string,maxAge:number) {
  setCookie(event,name,value,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'lax',path:'/',maxAge});
}
export function clearGoogleCookies(event:H3Event) {
  for(const name of [googleFlowCookie,googlePendingCookie])deleteCookie(event,name,{path:'/'});
}
