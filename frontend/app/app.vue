<script setup lang="ts">
import { featuredPartners } from '~/data/partners';
const menuOpen = ref(false);
const hydrated = ref(false);
onMounted(() => {
  hydrated.value = true;
});
const route = useRoute();
watch(
  () => route.fullPath,
  () => {
    menuOpen.value = false;
  },
);
const links = [
  { to: "/le-club", label: "Le club" },
  { to: "/agenda", label: "L’agenda" },
  { to: "/vie-du-club", label: "La vie du club" },
];
</script>
<template>
  <div>
    <a class="skip-link" href="#contenu">Aller au contenu</a>
    <div class="topline">
      <span>Le club qui vous emmène en altitude.</span
      ><NuxtLink to="/horaires-et-acces"
        >Beynost, Ain <span aria-hidden="true">↗</span></NuxtLink
      >
    </div>
    <header class="site-header">
      <NuxtLink to="/" aria-label="Vertical Côtière — accueil"
        ><BrandMark wordmark
      /></NuxtLink>
      <button
        class="menu-toggle"
        :disabled="!hydrated"
        :aria-expanded="menuOpen"
        aria-controls="navigation"
        @click="menuOpen = !menuOpen"
      >
        {{ menuOpen ? "Fermer" : "Menu" }}
        <span aria-hidden="true">{{ menuOpen ? "×" : "☰" }}</span>
      </button>
      <nav
        id="navigation"
        :class="{ open: menuOpen }"
        aria-label="Navigation principale"
      >
        <NuxtLink v-for="link in links" :key="link.to" :to="link.to">{{
          link.label
        }}</NuxtLink
        ><NuxtLink to="/inscriptions" class="button button-orange nav-cta"
          >Rejoindre le club <ArrowIcon
        /></NuxtLink>
      </nav>
    </header>
    <main id="contenu"><NuxtPage /></main>
    <section class="join-band">
      <div>
        <span class="eyebrow">On se retrouve au pied du mur ?</span>
        <h2>La prochaine prise,<br />c’est ensemble.</h2>
      </div>
      <NuxtLink to="/inscriptions" class="button button-light"
        >Rejoindre l’aventure <ArrowIcon /></NuxtLink
      ><span class="join-watermark" aria-hidden="true">↗</span>
    </section>
    <footer class="site-footer">
      <div class="footer-main">
        <div>
          <NuxtLink to="/" aria-label="Accueil"><BrandMark /></NuxtLink>
          <p>Des prises. Du partage.<br />Et l’envie d’aller plus haut.</p>
          <span class="footer-affiliation">Club affilié à la FFME</span>
        </div>
        <div>
          <h2>La vie verticale</h2>
          <NuxtLink to="/activites/competition">La compétition</NuxtLink
          ><NuxtLink to="/activites/sorties-nature">Les sorties nature</NuxtLink
          ><NuxtLink to="/activites/cours-escalade"
            >Les cours d’escalade</NuxtLink
          ><NuxtLink to="/agenda">L’agenda</NuxtLink
          ><NuxtLink to="/vie-du-club">La vie du club</NuxtLink>
        </div>
        <div>
          <h2>Les bons repères</h2>
          <NuxtLink to="/horaires-et-acces">Horaires & accès</NuxtLink
          ><NuxtLink to="/inscriptions">Inscriptions</NuxtLink
          ><NuxtLink to="/le-club">L’association</NuxtLink
          ><NuxtLink to="/contact">Nous contacter</NuxtLink
          ><NuxtLink to="/ressources">Documents & ressources</NuxtLink>
          <NuxtLink to="/partenaires">Nos partenaires</NuxtLink>
        </div>
        <div>
          <h2>Gardons le lien</h2>
          <a href="mailto:secretariat@vertical-cotiere.fr"
            >secretariat@vertical-cotiere.fr
            <span aria-hidden="true">↗</span></a
          >
          <p>Gymnase Louis Armstrong<br />Le Pré Mayeux, 01700 Beynost</p>
        </div>
      </div>
      <section class="footer-partners" aria-label="Affiliation et soutien">
        <div class="footer-partners-intro">
          <h2>Affiliation et soutien</h2>
          <NuxtLink to="/partenaires" class="text-link">Tous nos partenaires <ArrowIcon /></NuxtLink>
        </div>
        <div class="footer-partners-logos">
          <a v-for="partner in featuredPartners" :key="partner.id" :href="partner.url" target="_blank" rel="noopener noreferrer" class="footer-partner">
            <span class="footer-partner-logo"><img :src="partner.logo" :alt="partner.name" :width="partner.width" :height="partner.height" loading="lazy" /></span>
            <span class="footer-partner-caption">{{ partner.role }} <span aria-hidden="true">↗</span></span>
          </a>
        </div>
      </section>
      <div class="footer-bottom">
        <span>© {{ new Date().getFullYear() }} Vertical Côtière</span
        ><NuxtLink to="/informations">Informations & crédits photos</NuxtLink
        ><span>Fait pour grimper ensemble.</span>
      </div>
    </footer>
  </div>
</template>
