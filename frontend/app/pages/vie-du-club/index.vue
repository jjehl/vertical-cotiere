<script setup lang="ts">
const {data,error,pending,refresh}=await useClubContent();
const query=ref('');
const limit=ref(24);
const interactive=useInteractive();
const filtered=computed(()=>data.value.publications.filter(p=>`${p.title} ${p.summary} ${p.category}`.toLocaleLowerCase('fr').includes(query.value.toLocaleLowerCase('fr'))));
const visible=computed(()=>filtered.value.slice(0,limit.value));
watch(query,()=>{limit.value=24});
useSeoMeta({title:'La vie du club — Vertical Côtière',description:'Les nouvelles, les rendez-vous et les souvenirs en images de Vertical Côtière, dans un même fil.'});
</script>
<template>
  <div class="section listing-page">
    <span class="eyebrow">Ce qu’on partage</span>
    <h1>La vie<br>du <em>club.</em></h1>
    <p class="page-intro">Des nouvelles, des rendez-vous et des souvenirs en images.<br>Tout ce qu’on partage, au même endroit.</p>
    <label class="search-field"><span class="sr-only">Rechercher une publication</span><input v-model="query" :disabled="!interactive" type="search" placeholder="Rechercher une sortie, une information…"></label>
    <ContentState :error="error" :pending="pending" @retry="refresh()"/>
    <div class="news-grid publication-feed"><PublicationCard v-for="publication in visible" :key="publication.slug" :publication="publication"/></div>
    <p v-if="!error&&!pending&&!filtered.length" class="empty-state" role="status">Aucune publication ne correspond à votre recherche.</p>
    <div v-if="filtered.length>limit" class="publication-more"><button class="button button-dark" :disabled="!interactive" @click="limit+=24">Voir les publications précédentes ↓</button></div>
  </div>
</template>
