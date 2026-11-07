<script setup lang="ts">
import type {MediaFile} from '#shared/types';
const props=defineProps<{files?:MediaFile[];html?:string}>();
const visible=computed(()=>(props.files||[]).filter(file=>!props.html?.includes(file.url)));
</script>
<template>
  <section v-if="visible.length" class="content-attachments" aria-label="Photos et documents joints">
    <h3>Photos et documents</h3>
    <div class="content-attachment-grid">
      <a v-for="file in visible" :key="file.id" :href="file.url" target="_blank" rel="noopener noreferrer" class="content-attachment">
        <img v-if="file.mime.startsWith('image/')" :src="file.url+'?variant=thumbnail'" :alt="file.name" loading="lazy" :width="file.width" :height="file.height">
        <span>{{file.name}} <span aria-hidden="true">↗</span></span>
      </a>
    </div>
  </section>
</template>
