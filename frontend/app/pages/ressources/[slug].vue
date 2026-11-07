<script setup lang="ts">
const route = useRoute();
const { data, error, refresh } = await useClubContent();
const page = computed(() =>
  data.value.pages.find((p) => p.slug === route.params.slug),
);
if (!error.value && !page.value)
  throw createError({
    statusCode: 404,
    statusMessage: "Ressource introuvable",
  });
useSeoMeta({
  title: () => `${page.value?.title || "Ressources"} — Vertical Côtière`,
});
</script>
<template>
  <div class="section article-page">
    <ContentState :error="error" @retry="refresh()" />
    <article v-if="page">
      <NuxtLink to="/ressources" class="breadcrumb"
        >← Toutes les ressources</NuxtLink
      ><span class="eyebrow">{{ page.group }}</span>
      <h1>{{ page.title }}</h1>
      <ImportedContent :html="page.bodyHtml" class="resource-body" />
      <DocumentLinks :documents="page.documents" />
      <ContentAttachments :files="page.attachments" :html="page.bodyHtml" />
    </article>
  </div>
</template>
