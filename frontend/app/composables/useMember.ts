import type {MemberProfile} from '#shared/member';
export function useMember() {
  const profile=useState<MemberProfile|null>('member-profile',()=>null);
  const api=useRequestFetch();
  async function refresh() {
    try{profile.value=await api<MemberProfile>('/api/member/profile');}
    catch(error){profile.value=null;throw error;}
    return profile.value;
  }
  async function logout(){await api('/api/member/logout',{method:'POST'});profile.value=null;await navigateTo('/connexion');}
  return {profile,refresh,logout,api};
}
export function memberError(error:unknown) {
  const value=error as {data?:{statusMessage?:string;error?:{message?:string}};statusMessage?:string};
  return value.data?.error?.message||value.data?.statusMessage||value.statusMessage||'La demande a échoué. Réessayez.';
}
