<script setup lang="ts">
defineProps<{ wordmark?: boolean }>();
</script>
<template>
  <span class="brand">
    <svg v-if="wordmark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M5 36 19 10l8 15 5-9 12 20H5Z"
        stroke="currentColor"
        stroke-width="3"
        stroke-linejoin="round"
      />
      <path
        d="m14 20 5 6 4-7M29 23l3 5 4-5"
        stroke="currentColor"
        stroke-width="2"
      />
    </svg>
    <span v-if="wordmark" class="brand-name">
      VERTICAL<span>CÔTIÈRE<span class="brand-dot">.</span></span>
    </span>
    <img
      v-else
      src="/images/vertical-cotiere.jpg"
      alt="Vertical Côtière — logo du club"
      width="488"
      height="555"
    />
  </span>
</template>
