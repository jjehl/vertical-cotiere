<script setup lang="ts">
const { data, error, pending, refresh } = await useClubContent();
const now = new Date();
const upcoming = computed(() =>
  data.value.events.filter((e) => new Date(e.end) >= now).slice(0, 3),
);
const news = computed(() =>
  [...data.value.publications].sort((a, b) => (b.date||'').localeCompare(a.date||'')).slice(0, 3),
);
useSeoMeta({
  title: "Vertical Côtière — L’escalade, ensemble",
  ogTitle: "Vertical Côtière — L’escalade, ensemble",
  ogImage: "/images/hero.jpg",
});
</script>
<template>
  <div>
    <section class="hero">
      <img
        class="hero-photo"
        src="/images/hero.jpg"
        alt="Un grimpeur encordé progresse sur une paroi rocheuse"
        fetchpriority="high"
        width="1920"
        height="1400"
      />
      <div class="hero-shade" />
      <div class="hero-content">
        <span class="eyebrow hero-eyebrow"
          ><span class="small-line" /> Club d’escalade · Beynost</span
        >
        <h1>Plus haut.<br /><span>Ensemble.</span></h1>
        <p>
          La passion de la grimpe.<br />Le plaisir du collectif.<br />En salle
          comme en pleine nature.
        </p>
        <div class="hero-actions">
          <NuxtLink to="/le-club" class="hero-link"
            >Découvrir le club <span aria-hidden="true">↗</span></NuxtLink
          >
        </div>
      </div>
      <div class="hero-caption">
        <span class="hero-coordinate">45°50′ N &nbsp; 5°01′ E</span
        ><span>Les pieds sur terre.<br />La tête en altitude.</span>
      </div>
      <div class="hero-scroll" aria-hidden="true">
        L’AVENTURE COMMENCE ICI <span>↓</span>
      </div>
    </section>
    <div class="values-strip">
      <span>La grimpe pour tous</span><span aria-hidden="true">✳</span
      ><span>L’esprit d’équipe</span><span aria-hidden="true">✳</span
      ><span>Le goût de l’aventure</span><span aria-hidden="true">✳</span
      ><span>Club affilié FFME</span>
    </div>
    <section id="activites" class="section activities-section">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Une passion, plusieurs terrains de jeu</span>
          <h2>À chacun<br />son <em>ascension.</em></h2>
        </div>
        <p>
          La première voie, le prochain défi ou l’échappée au grand air. Il y a
          mille façons de vivre l’escalade. Trouvons la vôtre.
        </p>
      </div>
      <ContentState :error="error" :pending="pending" @retry="refresh()" />
      <div class="activity-grid">
        <ActivityCard
          v-for="(activity, i) in data.activities"
          :key="activity.slug"
          :activity="activity"
          :index="i"
        />
      </div>
    </section>
    <section class="club-manifesto">
      <span class="eyebrow">Bien plus qu’un sport</span>
      <h2>On vient pour grimper.<br />On reste pour <em>partager.</em></h2>
      <div>
        <p>
          À Vertical Côtière, on apprend à se faire confiance, à s’encourager et
          à aller un peu plus loin. Un club associatif ancré à Beynost, ouvert
          sur les autres et sur la nature.
        </p>
        <NuxtLink to="/le-club" class="text-link"
          >L’esprit Vertical Côtière <ArrowIcon
        /></NuxtLink>
      </div>
      <svg viewBox="0 0 300 230" class="contour-lines" aria-hidden="true">
        <path
          v-for="n in 9"
          :key="n"
          :d="`M ${-30 + n * 10} 220 Q ${70 + n * 7} ${-150 + n * 18} ${220 + n * 10} 220`"
          fill="none"
          stroke="currentColor"
          stroke-width="1"
        />
      </svg>
    </section>
    <section class="section agenda-preview">
      <div class="section-heading compact">
        <div>
          <span class="eyebrow">Les prochains rendez-vous</span>
          <h2>À vos <em>agendas.</em></h2>
        </div>
        <NuxtLink to="/agenda" class="text-link"
          >Tout le calendrier <ArrowIcon
        /></NuxtLink>
      </div>
      <EventRow v-for="event in upcoming" :key="event.slug" :event="event" />
      <p v-if="!error && !pending && !upcoming.length" class="empty-state">
        Les prochains rendez-vous arrivent bientôt. En attendant, on se retrouve
        au mur !
      </p>
    </section>
    <section class="section news-section">
      <div class="section-heading compact">
        <div>
          <span class="eyebrow">Ça bouge au club</span>
          <h2>La vie au <em>sommet.</em></h2>
        </div>
        <NuxtLink to="/vie-du-club" class="text-link"
          >Toute la vie du club <ArrowIcon
        /></NuxtLink>
      </div>
      <div class="news-grid">
        <PublicationCard v-for="publication in news" :key="publication.slug" :publication="publication" />
      </div>
    </section>
  </div>
</template>
