<script setup lang="ts">
const route = useRoute();
const { data, error, refresh } = await useClubContent();
const activity = computed(() =>
  data.value.activities.find((a) => a.slug === route.params.slug),
);
if (!error.value && !activity.value)
  throw createError({ statusCode: 404, statusMessage: "Activité introuvable" });
useSeoMeta({
  title: () => `${activity.value?.eyebrow || "Activités"} — Vertical Côtière`,
  description: () => activity.value?.summary,
});
</script>
<template>
  <div>
    <ContentState :error="error" @retry="refresh()" /><template v-if="activity"
      ><section class="detail-hero">
        <div>
          <NuxtLink to="/#activites" class="breadcrumb"
            >← Nos activités</NuxtLink
          ><span class="eyebrow">{{ activity.eyebrow }}</span>
          <h1>{{ activity.title }}</h1>
          <p>{{ activity.summary }}</p>
          <span class="pill">{{ activity.audience }}</span>
        </div>
        <img
          v-if="activity.image"
          :src="activity.image"
          :style="{objectPosition:activity.imagePosition}"
          :alt="activity.imageAlt || `Illustration : ${(activity.eyebrow || activity.title).toLowerCase()}`"
          width="1000"
          height="900"
        />
      </section>
      <section class="section prose-layout">
        <div>
          <span class="eyebrow">Trouver sa voie</span>
          <h2>La passion<br />en mouvement.</h2>
        </div>
        <div class="prose">
          <p v-for="(paragraph, i) in (activity.body || '').split('\n\n')" :key="i">
            {{ paragraph }}
          </p>
          <div class="inline-actions">
            <NuxtLink to="/inscriptions" class="button button-dark"
              >Comment s’inscrire <ArrowIcon /></NuxtLink
            ><NuxtLink to="/agenda" class="text-link"
              >Les rendez-vous <ArrowIcon
            /></NuxtLink>
          </div>
        </div></section
    ></template>
    <section v-if="activity" class="section activity-resources">
      <h2>Pour préparer la suite.</h2>
      <div class="resource-links">
        <template v-if="activity.slug === 'competition'"
          ><NuxtLink to="/ressources/competition"
            >La compétition au club <ArrowIcon /></NuxtLink
          ><NuxtLink to="/ressources/coupe-de-lain"
            >Coupe de l’Ain <ArrowIcon /></NuxtLink
          ><NuxtLink to="/ressources/equipe-departementale"
            >Équipe départementale <ArrowIcon /></NuxtLink></template
        ><template v-else-if="activity.slug === 'sorties-nature'"
          ><NuxtLink to="/ressources/sorties"
            >Organisation des sorties <ArrowIcon /></NuxtLink
          ><NuxtLink to="/ressources/fiches-securite"
            >Fiches de sécurité <ArrowIcon /></NuxtLink></template
        ><template v-else
          ><NuxtLink to="/horaires-et-acces"
            >Tous les horaires <ArrowIcon /></NuxtLink
          ><NuxtLink to="/ressources/baby-escalade"
            >Baby escalade <ArrowIcon /></NuxtLink
          ><NuxtLink to="/ressources/stages">Stages <ArrowIcon /></NuxtLink
          ><NuxtLink to="/ressources/location-chaussons"
            >Location de chaussons <ArrowIcon /></NuxtLink
        ></template>
      </div>
    </section>
    <div v-if="activity?.attachments?.length" class="section"><ContentAttachments :files="activity.attachments" /></div>
  </div>
</template>
