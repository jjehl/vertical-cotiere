<script setup lang="ts">
import { dateLabel } from "#shared/dates";
const { data, error, refresh } = await useClubContent();
const timetable = computed(
  () => data.value.timetable,
);
const course = computed(() => data.value.activities.find(activity => activity.slug === 'cours-escalade'));
const courseParagraphs = computed(() => (course.value?.body || '').split(/\n\s*\n|\\n\\n/).filter(Boolean));
const days = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];
const openings = computed(() => {
  const plan = timetable.value?.ufraps;
  if (!plan) return [];
  const result: string[] = [];
  for (
    let date = new Date(plan.opens + "T12:00:00Z");
    date.toISOString().slice(0, 10) <= plan.closes;
    date.setUTCDate(date.getUTCDate() + 1)
  ) {
    const day = date.toISOString().slice(0, 10);
    if (
      (date.getUTCDay() || 7) !== plan.day ||
      plan.holidays.includes(day) ||
      plan.closures.some((c) => day >= c.from && day <= c.until)
    )
      continue;
    result.push(day);
  }
  return result;
});
useSeoMeta({
  title: "Cours, horaires & accès — Vertical Côtière",
  description: () => course.value?.summary || "Les cours d’escalade, les créneaux et les lieux de pratique de Vertical Côtière.",
});
</script>
<template>
  <div class="section listing-page">
    <header class="course-heading" :class="{'course-heading--with-photo':course?.image}">
      <div>
        <span class="eyebrow">Apprendre, progresser, se retrouver</span>
        <h1>Cours, horaires<br />et <em>accès.</em></h1>
      </div>
      <img v-if="course?.image" class="course-heading__photo" :src="course.image" :alt="course.imageAlt || 'Une grimpeuse en salle pendant un cours d’escalade'" :style="{objectPosition:course.imagePosition}" width="600" height="450" />
    </header>
    <p class="page-intro">{{ course?.summary || 'Tous les repères pour choisir son cours et venir grimper au club.' }}</p>
    <ContentState :error="error" @retry="refresh()" />
    <section id="cours" class="course-overview" aria-labelledby="course-overview-title">
      <div class="prose">
        <h2 id="course-overview-title">Des premières prises à l’autonomie.</h2>
        <p v-for="(paragraph,index) in courseParagraphs" :key="index">{{ paragraph }}</p>
      </div>
      <aside class="course-links" aria-label="Préparer son cours">
        <NuxtLink to="#horaires">Choisir mon créneau <ArrowIcon /></NuxtLink>
        <NuxtLink to="#acces">Les lieux de pratique <ArrowIcon /></NuxtLink>
        <NuxtLink to="/inscriptions">Comment s’inscrire <ArrowIcon /></NuxtLink>
        <NuxtLink to="/ressources/baby-escalade">Le baby escalade <ArrowIcon /></NuxtLink>
        <NuxtLink to="/ressources/location-chaussons">Location de chaussons <ArrowIcon /></NuxtLink>
        <NuxtLink :to="{path:'/agenda',query:{categorie:'Stage'}}">Les stages à venir <ArrowIcon /></NuxtLink>
      </aside>
    </section>
    <section id="horaires" class="timetable-section">
      <span class="eyebrow">Gymnase Louis Armstrong · Beynost</span>
      <h2>Les cours {{ timetable?.season }}.</h2>
      <p class="fine-print">
        Planning publié par le club. Pour choisir votre inscription, vérifiez
        également le créneau proposé sur HelloAsso.
      </p>
      <p v-if="timetable?.note">{{ timetable.note }}</p>
      <TrainingWeek v-if="timetable" :sessions="timetable.sessions" :season="timetable.season" />
    </section>
    <section id="acces" class="timetable-section" aria-labelledby="locations-title">
      <h2 id="locations-title">Deux lieux pour grimper.</h2>
    <div class="location-grid">
      <article>
        <span class="eyebrow">Le mur du club</span>
        <h2>Gymnase<br />Louis Armstrong</h2>
        <p>Le Pré Mayeux<br />01700 Beynost</p>
        <p>Cours d’initiation, perfectionnement et entraînements du club.</p>
        <a
          href="https://www.google.com/maps/search/?api=1&query=Gymnase+Louis+Armstrong+Beynost"
          target="_blank"
          rel="noopener noreferrer"
          class="text-link"
          >Préparer mon itinéraire ↗</a
        >
      </article>
      <article>
        <span class="eyebrow">La pratique autonome</span>
        <h2>Mur de<br />l’UFRAPS</h2>
        <p>27 boulevard du 11 Novembre 1918<br />69100 Villeurbanne</p>
        <p>
          Accès le samedi selon le calendrier d’ouverture, réservé aux grimpeurs
          autonomes.
        </p>
        <a
          href="https://www.google.com/maps/search/?api=1&query=27+boulevard+du+11+novembre+1918+Villeurbanne"
          target="_blank"
          rel="noopener noreferrer"
          class="text-link"
          >Préparer mon itinéraire ↗</a
        >
      </article>
    </div>
    </section>
    <section class="timetable-section" v-if="timetable">
      <span class="eyebrow">Mur UFRAPS / SIUAPS · Villeurbanne</span>
      <h2>Les {{ days[timetable.ufraps.day - 1]?.toLowerCase() }}s au mur.</h2>
      <p class="page-intro">
        De {{ timetable.ufraps.start }} à {{ timetable.ufraps.end }}, pour les
        grimpeurs autonomes. Séance non encadrée.
      </p>
      <p>
        Ouverture de saison :
        {{ dateLabel(timetable.ufraps.opens + "T12:00:00Z") }}. Fermeture d’été
        après le {{ dateLabel(timetable.ufraps.closes + "T12:00:00Z") }}.
      </p>
      <h3>Fermetures pendant les vacances</h3>
      <div class="timetable-scroll">
        <table class="timetable">
          <thead>
            <tr>
              <th scope="col">Période</th>
              <th scope="col">Du</th>
              <th scope="col">Au (inclus)</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="closure in timetable.ufraps.closures"
              :key="closure.label"
            >
              <th scope="row">{{ closure.label }}</th>
              <td>{{ dateLabel(closure.from + "T12:00:00Z") }}</td>
              <td>{{ dateLabel(closure.until + "T12:00:00Z") }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <details v-if="timetable.ufraps.closedDays.length"><summary>Jours fériés et fermetures exceptionnelles</summary><ul class="opening-dates"><li v-for="closed in timetable.ufraps.closedDays" :key="closed.date">{{ dateLabel(closed.date+'T12:00:00Z') }} — {{ closed.label }}</li></ul></details>
      <details>
        <summary>Voir tous les {{ days[timetable.ufraps.day - 1]?.toLowerCase() }}s d’ouverture de la saison</summary>
        <ul class="opening-dates">
          <li v-for="day in openings" :key="day">
            {{
              dateLabel(day + "T12:00:00Z", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })
            }}
            · {{ timetable.ufraps.start }}–{{ timetable.ufraps.end }}
          </li>
        </ul>
      </details>
      <details>
        <summary>Consulter les plannings et documents publiés</summary>
        <ul class="schedule-documents"><li v-for="file in timetable.attachments" :key="file.id"><a :href="file.url" target="_blank" rel="noopener noreferrer">{{ file.name }} ↗</a></li></ul><p v-if="!timetable.attachments.length">Aucun document joint pour cette saison.</p>
      </details>
    </section>
    <div v-if="course?.attachments?.length" class="timetable-section"><ContentAttachments :files="course.attachments" /></div>
  </div>
</template>

<style scoped>
.course-heading { display: grid; align-items: center; }
.course-heading--with-photo { grid-template-columns: minmax(0, 1fr) minmax(180px, 280px); gap: 48px; }
.course-heading h1 { font-size: clamp(42px, 6.5vw, 88px); line-height: 1.02; letter-spacing: -.06em; margin-top: 23px; }
.course-heading__photo { width: 100%; height: 210px; object-fit: cover; border-radius: 12px; }
.course-overview { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(230px, 1fr); gap: 48px; margin-top: 32px; align-items: start; }
.course-overview h2 { font-size: clamp(22px, 2.3vw, 30px); line-height: 1.2; letter-spacing: -.03em; margin-bottom: 20px; }
.course-links { display: grid; border-top: 1px solid var(--line); }
.course-links a { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--line); font-size: 14px; }
.course-links a:hover { color: var(--orange); }
.course-links svg { flex-shrink: 0; }
@media (max-width: 760px) {
  .course-heading--with-photo { grid-template-columns: minmax(0, 1fr) 100px; gap: 16px; }
  .course-heading h1 { font-size: clamp(34px, 7vw, 48px); margin-top: 16px; }
  .course-heading__photo { height: 125px; }
  .course-overview { grid-template-columns: 1fr; gap: 24px; }
}
</style>
