<script setup lang="ts">
const {data,error,pending,refresh}=await useClubContent();
const query=ref('');
const limit=ref(24);
const interactive=useInteractive();
const filtered=computed(()=>data.value.publications.filter(p=>p.photoCount>1&&`${p.title} ${p.summary} ${p.category}`.toLocaleLowerCase('fr').includes(query.value.toLocaleLowerCase('fr'))));
const visible=computed(()=>filtered.value.slice(0,limit.value));
watch(query,()=>{limit.value=24});
useSeoMeta({title:'La vie du club — Vertical Côtière',description:'Les albums photo, les sorties et les souvenirs en images de Vertical Côtière.'});
</script>
<template>
  <div class="section listing-page">
    <span class="eyebrow">Ce qu’on partage</span>
    <h1>La vie<br>du <em>club.</em></h1>
    <p class="page-intro">Les sorties et les moments partagés, en images.<br>Retrouvez les albums photo de la vie du club.</p>
    <label class="search-field"><span class="sr-only">Rechercher un album photo</span><input v-model="query" :disabled="!interactive" type="search" placeholder="Rechercher un album, une sortie…"></label>
    <ContentState :error="error" :pending="pending" @retry="refresh()"/>
    <div class="news-grid publication-feed"><PublicationCard v-for="publication in visible" :key="publication.slug" :publication="publication"/></div>
    <p v-if="!error&&!pending&&!filtered.length" class="empty-state" role="status">{{query?'Aucun album photo ne correspond à votre recherche.':'Les prochains souvenirs en images seront bientôt ici.'}}</p>
    <div v-if="filtered.length>limit" class="publication-more"><button class="button button-dark" :disabled="!interactive" @click="limit+=24">Voir les albums précédents ↓</button></div>
  </div>
</template>
