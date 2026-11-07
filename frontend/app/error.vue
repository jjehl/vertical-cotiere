<script setup lang="ts">
defineProps<{ error: { statusCode: number; message: string } }>();
</script>
<template>
  <div class="error-page">
    <BrandMark /><span class="eyebrow">{{ error.statusCode }}</span>
    <h1>Une voie<br />à <em>retrouver.</em></h1>
    <p>
      {{
        error.statusCode === 404
          ? "Cette page n’existe pas ou a changé de place."
          : "Le site rencontre une difficulté temporaire."
      }}
    </p>
    <button class="button button-orange" @click="clearError({ redirect: '/' })">
      Revenir à l’accueil <ArrowIcon />
    </button>
  </div>
</template>
