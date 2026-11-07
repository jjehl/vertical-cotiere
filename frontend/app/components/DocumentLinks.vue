<script setup lang="ts">
import type {ClubDocument} from '#shared/types';
defineProps<{documents?:ClubDocument[]}>();
</script>
<template>
  <section v-if="documents?.length" class="club-document-section" aria-label="Documents de l’association">
    <span class="eyebrow">La vie de l’association</span>
    <h3>Les documents du club.</h3>
    <div class="club-document-links">
      <a v-for="document in documents" :key="document.slug" :href="document.url" target="_blank" rel="noopener noreferrer">
        <span class="document-format">{{document.format || 'Document'}}</span>
        <div><h4>{{document.title}}</h4><p v-if="document.description">{{document.description}}</p></div>
        <span aria-hidden="true">↗</span>
      </a>
    </div>
  </section>
</template>
