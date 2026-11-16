export default defineNuxtRouteMiddleware(async to=>{
  const {refresh}=useMember();
  try{const profile=await refresh();if(to.meta.memberAdmin&&profile.role!=='admin')return navigateTo('/compte');if(to.meta.contributor&&!['contributor','admin'].includes(profile.role))return navigateTo('/compte');}
  catch{return navigateTo('/connexion');}
});
