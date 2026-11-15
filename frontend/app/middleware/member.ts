export default defineNuxtRouteMiddleware(async to=>{
  const {refresh}=useMember();
  try{const profile=await refresh();if(to.meta.contributor&&profile.role!=='contributor')return navigateTo('/compte');}
  catch{return navigateTo('/connexion');}
});
