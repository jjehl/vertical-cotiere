<script setup lang="ts">
import { partners, featuredPartners } from '~/data/partners';

useSeoMeta({
  title: 'Nos partenaires — Vertical Côtière',
  description: 'La fédération, les collectivités et le réseau local qui accompagnent Vertical Côtière.',
});
</script>
<template>
  <div class="section listing-page partners-page">
    <span class="eyebrow">Le collectif, au-delà du mur</span>
    <h1>Bien <em>entourés.</em></h1>
    <p class="page-intro">Une fédération, un territoire et des liens qui font vivre l’escalade. Retrouvez les partenaires de Vertical Côtière.</p>

    <section aria-labelledby="featured-partners-title">
      <h2 id="featured-partners-title" class="partners-heading">Notre fédération et notre territoire.</h2>
      <div class="partners-grid partners-grid-featured">
        <a v-for="partner in featuredPartners" :key="partner.id" :href="partner.url" target="_blank" rel="noopener noreferrer" class="partner-card">
          <div class="partner-card-logo"><img :src="partner.logo" :alt="partner.name" :width="partner.width" :height="partner.height" /></div>
          <span class="eyebrow">{{ partner.role }}</span>
          <h3>{{ partner.label }}</h3>
          <span class="text-link">Visiter le site <span aria-hidden="true">↗</span></span>
        </a>
      </div>
    </section>

    <section class="partners-section" aria-labelledby="local-partners-title">
      <h2 id="local-partners-title" class="partners-heading">Les partenaires du club.</h2>
      <div class="partners-grid">
        <a v-for="partner in partners.filter(p => !p.featured)" :key="partner.id" :href="partner.url" target="_blank" rel="noopener noreferrer" class="partner-card">
          <div class="partner-card-logo"><img :src="partner.logo" :alt="partner.name" :width="partner.width" :height="partner.height" loading="lazy" /></div>
          <span class="eyebrow">{{ partner.role }}</span>
          <h3>{{ partner.label }}</h3>
          <span class="text-link">Visiter le site <span aria-hidden="true">↗</span></span>
        </a>
      </div>
    </section>

    <div class="notice">
      <h2>La grimpe se partage aussi entre clubs.</h2>
      <p>Retrouvez les clubs de grimpe de l’Ain et les liens utiles pour préparer vos rencontres.</p>
      <NuxtLink to="/ressources/clubs-dans-lain" class="text-link">Les clubs de grimpe <ArrowIcon /></NuxtLink>
    </div>
  </div>
</template>
