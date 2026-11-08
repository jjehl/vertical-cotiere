<script setup lang="ts">
import { dateLabel } from "#shared/dates";
const { data, error, refresh } = await useClubContent();
const timetable = computed(
  () => data.value.timetable,
);
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
useSeoMeta({ title: "Horaires & accès — Vertical Côtière" });
</script>
<template>
  <div class="section listing-page">
    <span class="eyebrow">Les bons repères</span>
    <h1>On se retrouve<br />au pied du <em>mur.</em></h1>
    <p class="page-intro">Deux lieux pour progresser et partager la grimpe.</p>
    <div id="acces" class="location-grid">
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
    <section id="horaires" class="timetable-section">
      <span class="eyebrow">Gymnase Louis Armstrong · Beynost</span>
      <h2>Les cours {{ timetable?.season }}.</h2>
      <ContentState :error="error" @retry="refresh()" />
      <p class="fine-print">
        Planning publié par le club. Pour choisir votre inscription, vérifiez
        également le créneau proposé sur HelloAsso.
      </p>
      <p v-if="timetable?.note">{{ timetable.note }}</p>
      <TrainingWeek v-if="timetable" :sessions="timetable.sessions" :season="timetable.season" />
      <details v-if="timetable">
        <summary>Consulter tous les détails en tableau</summary>
        <div class="timetable-scroll">
        <table class="timetable">
          <caption>
            Horaires des cours
            {{
              timetable.season
            }}
          </caption>
          <thead>
            <tr>
              <th scope="col">Jour</th>
              <th scope="col">Horaires</th>
              <th scope="col">Cours / public</th>
              <th scope="col">Années de naissance</th>
              <th scope="col">Places indiquées</th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="slot in timetable.sessions"
              :key="`${slot.day}-${slot.start}`"
            >
              <th scope="row">{{ days[slot.day - 1] }}</th>
              <td>{{ slot.start }} – {{ slot.end }}</td>
              <td>
                {{ slot.audience
                }}<small v-if="!slot.supervised">Pratique non encadrée</small>
              </td>
              <td>{{ slot.birthYears || "—" }}</td>
              <td>{{ slot.capacity || "—" }}</td>
            </tr>
          </tbody>
        </table>
        </div>
      </details>
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
    <section class="timetable-section">
      <h2>Informations d’accès complètes</h2>
      <SourcePage slug="acces" />
    </section>
  </div>
</template>
