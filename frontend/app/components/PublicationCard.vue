<script setup lang="ts">
import type {PublicationSummary} from '#shared/types';
import {dateLabel,eventDateLabel} from '#shared/dates';
defineProps<{publication:PublicationSummary}>();
</script>
<template>
  <NuxtLink :to="`/vie-du-club/${publication.slug}`" class="news-card publication-card" :class="{'publication-card-text':!publication.image}">
    <div v-if="publication.image" class="news-image">
      <img :src="publication.image" :alt="publication.imageAlt" :style="{objectPosition:publication.imagePosition}" width="640" height="420" loading="lazy">
      <span v-if="publication.photoCount">{{publication.photoCount}} photo{{publication.photoCount>1?'s':''}}</span>
    </div>
    <div class="news-meta"><template v-if="publication.meeting">Rendez-vous · {{eventDateLabel(publication.meeting)}}</template><template v-else-if="publication.date">{{dateLabel(publication.date)}}</template><template v-else>Archives du club</template></div>
    <h3>{{publication.title}}</h3>
    <p v-if="publication.summary">{{publication.summary}}</p>
    <span class="text-link">Lire la suite <ArrowIcon/></span>
  </NuxtLink>
</template>
