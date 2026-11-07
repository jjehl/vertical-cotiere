<script setup lang="ts">
import type { Activity } from "#shared/types";
defineProps<{ activity: Activity; index: number }>();
</script>
<template>
  <NuxtLink :to="`/activites/${activity.slug}`" class="activity-card">
    <div class="activity-photo">
      <img
        v-if="activity.image"
        :src="activity.image"
        :style="{objectPosition:activity.imagePosition}"
        :alt="
          activity.imageAlt || (activity.eyebrow === 'Sorties nature'
            ? 'Grimpeur sur une falaise en pleine nature'
            : 'Grimpeur sur un mur de bloc en salle')
        "
        loading="lazy"
        width="600"
        height="750"
      /><span class="photo-label">{{ activity.tag }}</span
      ><span class="card-number">0{{ index + 1 }}</span>
    </div>
    <div class="activity-heading">
      <span class="eyebrow">{{ activity.eyebrow }}</span
      ><ArrowIcon />
    </div>
    <h3>{{ activity.title }}</h3>
    <p>{{ activity.summary }}</p>
    <span class="activity-audience">{{ activity.audience }}</span>
  </NuxtLink>
</template>
