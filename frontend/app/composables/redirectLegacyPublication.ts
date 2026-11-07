export async function redirectLegacyPublication(kind:'actualites'|'agenda'|'albums') {
  const route=useRoute();
  const nuxtApp=useNuxtApp();
  const {data,error}=await useFetch('/api/publication-link',{query:{path:`/${kind}/${String(route.params.slug)}`}});
  if(!data.value)throw createError({statusCode:error.value?.statusCode||404,statusMessage:'Publication introuvable'});
  const url=data.value.url;
  return nuxtApp.runWithContext(()=>navigateTo({path:url,query:route.query},{redirectCode:301,replace:true}));
}
