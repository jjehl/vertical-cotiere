<script setup lang="ts">
defineProps<{ error?: unknown; pending?: boolean }>();
defineEmits<{ retry: [] }>();
</script>
<template>
  <div v-if="error" class="content-state" role="alert">
    <h2>Une petite pause dans l’ascension.</h2>
    <p>Les contenus ne sont pas disponibles pour le moment.</p>
    <button class="button button-dark" @click="$emit('retry')">
      Réessayer <ArrowIcon />
    </button>
  </div>
  <p v-else-if="pending" role="status" class="content-state">
    Chargement des contenus…
  </p>
</template>
