<script setup lang="ts">
const props = defineProps<{ slug: string }>();
const { data, error, refresh } = await useClubContent();
const page = computed(() =>
  data.value.pages.find((p) => p.slug === props.slug),
);
</script>
<template>
  <ContentState :error="error" @retry="refresh()" /><ImportedContent
    v-if="page"
    :html="page.bodyHtml"
  /><DocumentLinks v-if="page" :documents="page.documents"/><ContentAttachments v-if="page" :files="page.attachments" :html="page.bodyHtml" />
</template>
