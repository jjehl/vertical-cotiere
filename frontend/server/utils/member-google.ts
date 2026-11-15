import {timingSafeEqual} from 'node:crypto';
import {memberReturnPath} from '../../shared/member-google.ts';
export interface GoogleFlow {state:string;nonce:string;codeVerifier:string;returnPath:string;expires:number}
export function readGoogleFlow(cookie:string|undefined,state:unknown):GoogleFlow|null {
  try {
    const flow=JSON.parse(cookie||'') as GoogleFlow;
    if(typeof state!=='string'||!(/^[a-zA-Z0-9_-]{43}$/).test(state)||typeof flow.state!=='string'||flow.state.length!==state.length||!timingSafeEqual(Buffer.from(state),Buffer.from(flow.state)))return null;
    if(!Number.isFinite(flow.expires)||flow.expires<=Date.now()||![flow.nonce,flow.codeVerifier].every(value=>typeof value==='string'&&/^[a-zA-Z0-9_-]{43}$/.test(value)))return null;
    return {...flow,returnPath:memberReturnPath(flow.returnPath)};
  }catch{return null;}
}
