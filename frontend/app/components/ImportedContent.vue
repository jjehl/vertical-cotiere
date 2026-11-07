<script setup lang="ts">
defineProps<{ html: string }>();
</script>
<template><div class="imported-content prose" v-html="html" /></template>
