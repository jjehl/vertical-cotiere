<script setup lang="ts">
useSeoMeta({ title: "Rejoindre le club — Vertical Côtière" });
</script>
<template>
  <div class="section listing-page">
    <span class="eyebrow">Saison 2026–2027</span>
    <h1>Votre prochaine<br /><em>aventure.</em></h1>
    <p class="page-intro">
      Les inscriptions se font sur HelloAsso.<br />Prenez le temps de choisir le
      bon créneau avant de vous lancer.
    </p>
    <div class="steps-grid">
      <div>
        <span>01</span>
        <h2>Trouvez votre voie.</h2>
        <p>
          Cours, compétition, pratique autonome ou baby escalade : découvrez les
          activités adaptées à votre âge et votre niveau.
        </p>
        <NuxtLink to="/#activites" class="text-link"
          >Voir les activités <ArrowIcon
        /></NuxtLink>
      </div>
      <div>
        <span>02</span>
        <h2>Lisez les modalités.</h2>
        <p>
          Consultez les consignes de saison, les réductions et les conditions de
          remboursement. En cas de doute, contactez le secrétariat avant de
          payer.
        </p>
        <NuxtLink to="#modalites" class="text-link"
          >Les consignes complètes <ArrowIcon
        /></NuxtLink>
      </div>
      <div>
        <span>03</span>
        <h2>Rejoignez le collectif.</h2>
        <p>
          Vérifiez les horaires et les places sur la campagne HelloAsso, puis
          complétez votre adhésion sur leur site sécurisé.
        </p>
        <a
          href="https://www.helloasso.com/associations/vertical-cotiere/adhesions/adhesions-escalade-2026-27-2"
          target="_blank"
          rel="noopener noreferrer"
          class="button button-orange"
          >S’inscrire sur HelloAsso ↗</a
        >
      </div>
    </div>
    <div class="notice">
      <h2>Un petit doute avant le départ ?</h2>
      <p>Le secrétariat peut vous aider à choisir votre inscription.</p>
      <a href="mailto:secretariat@vertical-cotiere.fr" class="text-link"
        >secretariat@vertical-cotiere.fr <ArrowIcon
      /></a>
    </div>
    <section id="modalites" class="timetable-section">
      <h2>Les modalités de la saison.</h2>
      <SourcePage slug="inscriptions_25-26" />
    </section>
  </div>
</template>
