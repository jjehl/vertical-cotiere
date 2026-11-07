<script setup lang="ts">
const { data, error, refresh } = await useClubContent();
const query = ref("");
const groups = computed(() => [
  ...new Set(data.value.pages.map((p) => p.group)),
]);
const visible = computed(() =>
  data.value.pages.filter((p) =>
    `${p.title} ${p.group}`
      .toLocaleLowerCase("fr")
      .includes(query.value.toLocaleLowerCase("fr")),
  ),
);
useSeoMeta({ title: "Toutes les ressources — Vertical Côtière" });
</script>
<template>
  <div class="section listing-page">
    <span class="eyebrow">Tout le club, au même endroit</span>
    <h1>Les bons<br /><em>repères.</em></h1>
    <p class="page-intro">
      Stages, compétitions, règlements, sécurité, partenaires et vie
      associative. Retrouvez les pages et documents du club.
    </p>
    <NuxtLink to="/documents" class="button button-dark"
      >Tous les documents à télécharger <ArrowIcon
    /></NuxtLink>
    <div class="resource-body">
      <label class="search-field"
        ><span class="sr-only">Rechercher une ressource</span
        ><input
          v-model="query"
          type="search"
          placeholder="Rechercher une ressource"
      /></label>
    </div>
    <ContentState :error="error" @retry="refresh()" />
    <section v-for="group in groups" :key="group" class="resource-group">
      <h2>{{ group }}</h2>
      <div class="resource-links">
        <NuxtLink
          v-for="page in visible.filter((p) => p.group === group)"
          :key="page.slug"
          :to="`/ressources/${page.slug}`"
          >{{ page.title }}<ArrowIcon
        /></NuxtLink>
      </div>
    </section>
    <p v-if="!visible.length" role="status">
      Aucune ressource ne correspond à la recherche.
    </p>
  </div>
</template>
