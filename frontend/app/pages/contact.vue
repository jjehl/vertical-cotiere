<script setup lang="ts">
useSeoMeta({ title: "Nous contacter — Vertical Côtière" });
</script>
<template>
  <div class="section listing-page">
    <span class="eyebrow">La première prise de contact</span>
    <h1>Parlons<br /><em>escalade.</em></h1>
    <p class="page-intro">
      Une question sur les cours, les inscriptions ou la vie du club ?<br />Le
      bon contact, au bon endroit.
    </p>
    <div class="contact-list">
      <a href="mailto:secretariat@vertical-cotiere.fr"
        ><span>Inscriptions, cours & informations</span>
        <h2>Le secrétariat</h2>
        <span>secretariat@vertical-cotiere.fr</span><ArrowIcon /></a
      ><a href="mailto:president@vertical-cotiere.fr"
        ><span>Association & partenariats</span>
        <h2>La présidence</h2>
        <span>president@vertical-cotiere.fr</span><ArrowIcon /></a
      ><a href="mailto:tresoriere@vertical-cotiere.fr"
        ><span>Règlements & remboursements</span>
        <h2>La trésorerie</h2>
        <span>tresoriere@vertical-cotiere.fr</span><ArrowIcon
      /></a>
    </div>
    <section class="timetable-section">
      <h2>Le bureau et les encadrants.</h2>
      <SourcePage slug="contacts" />
    </section>
  </div>
</template>
