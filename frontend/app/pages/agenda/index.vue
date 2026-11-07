<script setup lang="ts">
import {
  dateLabel,
  eventIsInMonth,
  eventIsOnDay,
  parisDay,
} from "#shared/dates";
const route = useRoute();
const router = useRouter();
const { data, error, pending, refresh } = await useClubContent();
const interactive = useInteractive();
const categories = [
  "Tous",
  "Cours",
  "Compétition",
  "Sortie",
  "Stage",
  "Vie du club",
];
const category = ref(
  categories.includes(String(route.query.categorie))
    ? String(route.query.categorie)
    : "Tous",
);
const tag = ref(String(route.query.tag || ""));
const view = ref(
  ["mois", "jour"].includes(String(route.query.vue))
    ? String(route.query.vue)
    : "liste",
);
const query = ref(String(route.query.q || ""));
const month = ref(
  /^\d{4}-(0[1-9]|1[0-2])$/.test(String(route.query.mois))
    ? String(route.query.mois)
    : parisDay(new Date().toISOString()).slice(0, 7),
);
const day = ref(
  /^\d{4}-\d{2}-\d{2}$/.test(String(route.query.jour))
    ? String(route.query.jour)
    : month.value + "-01",
);
const tags = computed(() =>
  [...new Set(data.value.events.flatMap((e) => e.tags || []))].sort(),
);
const filtered = computed(() =>
  data.value.events.filter(
    (e) =>
      eventIsInMonth(e, month.value) &&
      (category.value === "Tous" || e.category === category.value) &&
      (!tag.value || e.tags?.includes(tag.value)) &&
      `${e.title} ${e.summary} ${e.location}`
        .toLocaleLowerCase("fr")
        .includes(query.value.toLocaleLowerCase("fr")),
  ),
);
const daily = computed(() =>
  filtered.value.filter((e) => eventIsOnDay(e, day.value)),
);
const monthTitle = computed(() =>
  dateLabel(month.value + "-15T12:00:00Z", { month: "long", year: "numeric" }),
);
const cells = computed(() => {
  const [year, m] = month.value.split("-").map(Number) as [number, number];
  const offset = (new Date(Date.UTC(year, m - 1, 1)).getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return Array.from({ length: Math.ceil((offset + days) / 7) * 7 }, (_, i) =>
    i >= offset && i < offset + days ? i - offset + 1 : null,
  );
});
function moveMonth(delta: number) {
  const [year, m] = month.value.split("-").map(Number) as [number, number];
  month.value = new Date(Date.UTC(year, m - 1 + delta, 15))
    .toISOString()
    .slice(0, 7);
}
function eventsOn(value: number) {
  return filtered.value.filter((e) =>
    eventIsOnDay(e, `${month.value}-${String(value).padStart(2, "0")}`),
  );
}
const exportUrl = computed(() => {
  const params = new URLSearchParams({ mois: month.value });
  if (category.value !== "Tous") params.set("categorie", category.value);
  if (tag.value) params.set("tag", tag.value);
  return "/api/agenda.ics?" + params.toString();
});
const origin = useRequestURL().origin;
const subscriptionUrl = computed(() => {
  const params = new URLSearchParams();
  if (category.value !== "Tous") params.set("categorie", category.value);
  if (tag.value) params.set("tag", tag.value);
  return (
    origin.replace(/^https?:/, "webcal:") +
    "/api/agenda.ics" +
    (params.size ? "?" + params.toString() : "")
  );
});
watch(month, () => {
  if (!day.value.startsWith(month.value)) day.value = month.value + "-01";
});
watch(day, () => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(day.value))
    month.value = day.value.slice(0, 7);
});
watch([month, category, tag, view, day, query], () => {
  if (!interactive.value) return;
  const params: Record<string, string> = { mois: month.value, vue: view.value };
  if (category.value !== "Tous") params.categorie = category.value;
  if (tag.value) params.tag = tag.value;
  if (view.value === "jour") params.jour = day.value;
  if (query.value) params.q = query.value;
  router.replace({ query: params });
});
useSeoMeta({
  title: "L’agenda — Vertical Côtière",
  description:
    "Tous les rendez-vous du club : cours, compétitions, stages, sorties et vie associative.",
});
</script>
<template>
  <div class="section listing-page">
    <span class="eyebrow">Se retrouver, tout simplement</span>
    <h1>Le prochain<br /><em>rendez-vous.</em></h1>
    <p class="page-intro">
      Une séance au mur, un défi à relever, une journée dehors.<br />Tous les
      temps forts du club, au même endroit.
    </p>
    <div class="agenda-tools">
      <div class="filter-tabs" aria-label="Filtrer par activité">
        <button
          v-for="item in categories"
          :key="item"
          :disabled="!interactive"
          :aria-pressed="category === item"
          :class="{ active: category === item }"
          @click="category = item"
        >
          {{ item }}
        </button>
      </div>
      <label class="search-field"
        ><span class="sr-only">Rechercher un événement</span
        ><input
          :disabled="!interactive"
          v-model="query"
          type="search"
          placeholder="Rechercher un rendez-vous"
        /><span aria-hidden="true">⌕</span></label
      >
    </div>
    <div class="agenda-secondary-tools">
      <label
        >Aller au mois
        <input
          v-model="month"
          :disabled="!interactive"
          type="month"
          min="1900-01"
          max="2100-12"
          required
      /></label>
      <label
        >Thème
        <select v-model="tag" :disabled="!interactive">
          <option value="">Tous les thèmes</option>
          <option v-for="item in tags" :key="item" :value="item">
            {{ item }}
          </option>
        </select></label
      >
      <a :href="exportUrl" download class="text-link"
        >Exporter ce mois (.ics) ↓</a
      ><a :href="subscriptionUrl" class="text-link"
        >S’abonner au calendrier ↗</a
      >
    </div>
    <div class="month-toolbar">
      <div>
        <button
          :disabled="!interactive"
          aria-label="Mois précédent"
          @click="moveMonth(-1)"
        >
          ←
        </button>
        <h2>{{ monthTitle }}</h2>
        <button
          :disabled="!interactive"
          aria-label="Mois suivant"
          @click="moveMonth(1)"
        >
          →
        </button>
      </div>
      <div class="view-toggle">
        <button
          v-for="item in [
            { key: 'liste', label: 'Liste' },
            { key: 'mois', label: 'Mois' },
            { key: 'jour', label: 'Jour' },
          ]"
          :key="item.key"
          :disabled="!interactive"
          :aria-pressed="view === item.key"
          :class="{ active: view === item.key }"
          @click="view = item.key"
        >
          {{ item.label }}
        </button>
      </div>
    </div>
    <ContentState :error="error" :pending="pending" @retry="refresh()" />
    <template v-if="!error && !pending">
      <div v-if="view === 'liste'">
        <EventRow v-for="event in filtered" :key="event.slug" :event="event" />
        <p v-if="!filtered.length" class="empty-state" role="status">
          Aucun rendez-vous ne correspond à votre recherche pour ce mois.
        </p>
      </div>
      <div v-else-if="view === 'jour'">
        <label class="day-picker"
          >Choisir un jour
          <input
            v-model="day"
            :disabled="!interactive"
            type="date"
            required /></label
        ><EventRow v-for="event in daily" :key="event.slug" :event="event" />
        <p v-if="!daily.length" class="empty-state" role="status">
          Aucun rendez-vous pour ce jour.
        </p>
      </div>
      <div v-else class="calendar" aria-label="Calendrier mensuel">
        <div
          v-for="label in ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']"
          :key="label"
          class="calendar-weekday"
        >
          {{ label }}
        </div>
        <div
          v-for="(value, i) in cells"
          :key="i"
          class="calendar-day"
          :class="{ outside: !value }"
        >
          <span v-if="value">{{ value }}</span
          ><template v-if="value"
            ><NuxtLink
              v-for="event in eventsOn(value)"
              :key="event.slug"
              :to="`/vie-du-club/${event.slug}`"
              >{{ event.title
              }}<small>{{
                event.allDay
                  ? "Toute la journée"
                  : dateLabel(event.start, {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
              }}</small></NuxtLink
            ></template
          >
        </div>
      </div>
    </template>
    <p class="fine-print">
      Heures affichées dans le fuseau Europe/Paris. Retrouvez aussi les
      <NuxtLink to="/horaires-et-acces#horaires"
        >horaires des cours et le calendrier UFRAPS</NuxtLink
      >.
    </p>
  </div>
</template>
