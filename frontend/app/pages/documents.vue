<script setup lang="ts">
const {
  data: documents,
  error,
  refresh,
} = await useFetch("/api/documents", { default: () => [] });
const query = ref("");
const visible = computed(() =>
  documents.value.filter((d) =>
    [d.title,d.category,d.description].filter(Boolean).join(' ')
      .toLocaleLowerCase("fr")
      .includes(query.value.toLocaleLowerCase("fr")),
  ),
);
useSeoMeta({ title: "Documents du club — Vertical Côtière" });
</script>
<template>
  <div class="section listing-page">
    <span class="eyebrow">Règlements, sécurité et archives</span>
    <h1>Les documents<br />à <em>portée de main.</em></h1>
    <p class="page-intro">
      Retrouvez les fichiers publiés par le club. Les dates figurant dans les
      titres permettent de distinguer les saisons et les archives.
    </p>
    <label class="search-field"
      ><span class="sr-only">Rechercher un document</span
      ><input
        v-model="query"
        type="search"
        placeholder="Rechercher un document" /></label
    ><ContentState :error="error" @retry="refresh()" />
    <div class="resource-links resource-body">
      <a
        v-for="document in visible"
        :key="document.url"
        :href="document.url"
        target="_blank"
        rel="noopener noreferrer"
        ><div><strong>{{ document.title }}</strong><small class="document-description">{{ document.category }}<template v-if="document.description"> · {{ document.description }}</template></small></div> <span>{{ document.format }} ↗</span></a
      >
    </div>
    <p v-if="!error && !visible.length" class="empty-state" role="status">
      Aucun document ne correspond à votre recherche.
    </p>
  </div>
</template>
