<script setup lang="ts">
const {data,error,refresh}=await useClubContent();
const presentation=computed(()=>data.value.pages.find(page=>page.slug==='presentation'));
const details=computed(()=>(presentation.value?.bodyHtml||'')
  .replace(/<img\b[^>]*>/gi,'')
  .replace(/<a\b[^>]*>\s*<\/a>/gi,'')
  .replace(/<p>\s*(?:&nbsp;|<br\s*\/?>)*\s*<\/p>/gi,''));
useSeoMeta({title:'L’esprit Vertical Côtière — Le club',description:'Un club d’escalade à Beynost, pour apprendre, se dépasser et partager la grimpe en salle comme en pleine nature.'});
</script>
<template>
  <div class="club-page">
    <section class="club-intro">
      <div class="club-intro-copy"><span class="eyebrow">Un club, un collectif · Beynost</span><h1>L’esprit<br><em>Vertical Côtière.</em></h1><p>On vient pour grimper.<br>On reste pour partager.</p><p class="club-intro-description">Apprendre à se faire confiance, s’encourager et aller un peu plus loin. En salle comme en pleine nature, la passion de l’escalade se vit ensemble.</p><div class="inline-actions"><NuxtLink to="/inscriptions" class="button button-orange">Rejoindre le club <ArrowIcon/></NuxtLink><a href="#le-club-en-detail" class="text-link">Découvrir l’association ↓</a></div></div>
      <div class="club-intro-photo"><img src="/images/cours.jpg" alt="Grimpeur en mouvement sur un mur de bloc" width="800" height="900" fetchpriority="high"><span class="club-photo-caption">Des prises. Du partage. Du collectif.</span><img class="club-photo-badge" src="/images/vertical-cotiere.jpg" alt="Logo de Vertical Côtière" width="488" height="555"></div>
    </section>
    <section class="club-values" aria-label="L’esprit du club"><article><span>01 / La confiance</span><h2>Apprendre à son rythme.</h2><p>Des premières prises à l’autonomie, progresser avec les bons repères et les méthodes de sécurité.</p></article><article><span>02 / Le collectif</span><h2>Se dépasser ensemble.</h2><p>S’encourager à l’entraînement, partager les défis de la compétition et participer à la vie du club.</p></article><article><span>03 / L’aventure</span><h2>Garder l’envie d’explorer.</h2><p>Prolonger la grimpe hors du gymnase, découvrir la falaise et partager le plaisir du grand air.</p></article></section>
    <section id="le-club-en-detail" class="club-details"><div class="club-details-heading"><span class="eyebrow">L’association au quotidien</span><h2>Un club ancré ici.<br>Des horizons <em>partagés.</em></h2></div><div class="club-details-layout"><div class="club-details-body"><ContentState :error="error" @retry="refresh()"/><ImportedContent v-if="details" :html="details"/><DocumentLinks :documents="presentation?.documents"/><ContentAttachments :files="presentation?.attachments" :html="presentation?.bodyHtml"/></div><aside class="club-practical"><span class="eyebrow">Les bons repères</span><NuxtLink to="/horaires-et-acces"><span>01</span><div><h3>Où et quand grimper ?</h3><p>Les murs, les cours et les créneaux.</p></div><ArrowIcon/></NuxtLink><NuxtLink to="/activites/competition"><span>02</span><div><h3>Le goût du défi.</h3><p>La compétition au sein du club.</p></div><ArrowIcon/></NuxtLink><NuxtLink to="/activites/sorties-nature"><span>03</span><div><h3>L’appel du dehors.</h3><p>Les sorties et les moments partagés.</p></div><ArrowIcon/></NuxtLink><div class="club-volunteers"><h3>Envie de donner un coup de main ?</h3><p>L’association vit aussi grâce à ses bénévoles. Échangeons !</p><NuxtLink to="/contact" class="text-link">Rencontrons-nous <ArrowIcon/></NuxtLink></div></aside></div></section>
  </div>
</template>
