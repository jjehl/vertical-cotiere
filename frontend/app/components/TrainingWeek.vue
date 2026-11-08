<script setup lang="ts">
import { trainingDays, trainingWeek } from '#shared/training-week'
import type { TrainingSlot } from '#shared/types'

const props = defineProps<{ sessions: TrainingSlot[]; season: string }>()
const week = computed(() => trainingWeek(props.sessions))
const selected = ref<TrainingSlot | null>(null)
const dialog = ref<HTMLDialogElement | null>(null)
const kind = (slot: TrainingSlot) => !slot.supervised ? 'autonomy' : /compétition/i.test(slot.audience) ? 'competition' : 'course'
async function showSlot(slot: TrainingSlot) {
  selected.value = slot
  await nextTick()
  dialog.value?.showModal()
}
function closeBackdrop(event: MouseEvent) {
  if (!dialog.value || event.target !== dialog.value) return
  const rect = dialog.value.getBoundingClientRect()
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.value.close()
}
</script>

<template>
  <section class="training-week" :aria-label="`Semaine type des cours ${season}`">
    <div class="training-week__intro">
      <p>Semaine type</p>
      <ul class="training-week__legend" aria-label="Types de séances">
        <li><span class="training-week__dot training-week__dot--course" />Cours encadrés</li>
        <li><span class="training-week__dot training-week__dot--competition" />Compétition</li>
        <li><span class="training-week__dot training-week__dot--autonomy" />Pratique autonome</li>
      </ul>
    </div>
    <p class="training-week__hint">Sélectionnez un créneau pour voir le public, les années de naissance et les places indiquées.</p>
    <div v-if="sessions.length" class="training-week__grid" :style="{ '--days': week.days.length, '--minutes': week.end - week.start }">
      <div class="training-week__scale" aria-hidden="true">
        <div class="training-week__day-heading" />
        <div class="training-week__hours">
          <span v-for="hour in week.hours" :key="hour.minute" :style="{ top: `${(hour.minute - week.start) / (week.end - week.start) * 100}%` }">{{ hour.label }}</span>
        </div>
      </div>
      <section v-for="day in week.days" :key="day.number" class="training-week__day" :aria-labelledby="`training-day-${day.number}`">
        <h3 :id="`training-day-${day.number}`" class="training-week__day-heading">{{ day.name }}<span>{{ day.slots.length }} créneau{{ day.slots.length > 1 ? 'x' : '' }}</span></h3>
        <ol class="training-week__slots" :aria-label="`Créneaux du ${day.name.toLowerCase()}`">
          <li v-for="item in day.slots" :key="item.key" class="training-week__slot" :style="{ top: `${(item.start - week.start) / (week.end - week.start) * 100}%`, height: `${(item.end - item.start) / (week.end - week.start) * 100}%`, left: `${item.lane / item.lanes * 100}%`, width: `${100 / item.lanes}%` }">
            <button type="button" class="training-session" :class="`training-session--${kind(item.slot)}`" aria-haspopup="dialog" :aria-label="`${day.name}, ${item.slot.start} à ${item.slot.end}, ${item.slot.audience}. Voir les détails`" @click="showSlot(item.slot)">
              <span class="training-session__time">{{ item.slot.start }} – {{ item.slot.end }}</span>
              <strong class="training-session__audience">{{ item.slot.audience }}</strong>
              <span v-if="!item.slot.supervised" class="training-session__note">Non encadré</span>
            </button>
          </li>
          <li v-if="!day.slots.length" class="training-week__empty">Pas de cours</li>
        </ol>
      </section>
    </div>
    <p v-else class="training-week__hint">Le planning des cours sera publié prochainement.</p>

    <dialog ref="dialog" class="training-detail" aria-labelledby="training-detail-title" @close="selected = null" @click="closeBackdrop">
      <template v-if="selected">
        <header><span class="eyebrow">{{ selected.label || 'Votre créneau' }}</span><button type="button" aria-label="Fermer le créneau" @click="dialog?.close()">×</button></header>
        <h3 id="training-detail-title">{{ selected.audience }}</h3>
        <p class="training-detail__time">{{ trainingDays[selected.day - 1] }} · {{ selected.start }} – {{ selected.end }}</p>
        <dl>
          <dt>Lieu</dt><dd>Gymnase Louis Armstrong, Beynost</dd>
          <dt>Années de naissance</dt><dd>{{ selected.birthYears || 'Non précisées' }}</dd>
          <dt>Places indiquées</dt><dd>{{ selected.capacity ?? 'Non précisées' }}</dd>
          <dt>Encadrement</dt><dd>{{ selected.supervised ? 'Séance encadrée' : 'Pratique autonome, non encadrée' }}</dd>
        </dl>
        <p class="fine-print">Le nombre de places indique la capacité du créneau. Vérifiez les disponibilités sur HelloAsso lors de l’inscription.</p>
      </template>
    </dialog>
  </section>
</template>

<style scoped>
.training-week { margin-top: 28px; }
.training-week__intro { display: flex; align-items: flex-end; justify-content: space-between; gap: 24px; }
.training-week__intro p { font-size: 19px; font-weight: 700; letter-spacing: -.03em; }
.training-week__legend { display: flex; gap: 16px; flex-wrap: wrap; list-style: none; padding: 0; margin: 0; font-size: 11px; }
.training-week__legend li { display: flex; align-items: center; gap: 6px; }
.training-week__dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.training-week__dot--course { background: #446a55; }.training-week__dot--competition { background: var(--orange); }.training-week__dot--autonomy { background: #8d7040; }
.training-week__hint { margin: 14px 0 24px; font-size: 12px; color: var(--muted); line-height: 1.6; }
.training-week__grid { --minute-height: 1.25px; display: grid; grid-template-columns: 52px repeat(var(--days), minmax(0, 1fr)); border: 1px solid var(--line); border-radius: 12px; background: #fcfbf7; padding: 0 8px 22px 0; }
.training-week__scale, .training-week__day { min-width: 0; }
.training-week__day-heading { height: 64px; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 4px; font-size: 14px; }
.timetable-section .training-week__day-heading { font-size: 14px; margin: 0; }
.training-week__day-heading span { font-size: 10px; font-weight: 400; color: var(--muted); }
.training-week__hours, .training-week__slots { height: calc(var(--minutes) * var(--minute-height)); position: relative; }
.training-week__hours span { position: absolute; right: 9px; transform: translateY(-50%); color: var(--muted); font-size: 10px; font-variant-numeric: tabular-nums; }
.training-week__slots { padding: 0; margin: 0; list-style: none; border-left: 1px solid var(--line); background: repeating-linear-gradient(to bottom, var(--line) 0 1px, transparent 1px calc(60 * var(--minute-height))); }
.training-week__slot { position: absolute; padding: 2px 3px; min-width: 0; }
.training-session { width: 100%; height: 100%; min-height: 0; padding: 8px; border: 1px solid #b8ccbc; border-left: 3px solid #446a55; border-radius: 6px; background: #e8efe6; color: #263e2e; text-align: left; display: flex; flex-direction: column; gap: 5px; overflow: hidden; transition: box-shadow .15s, filter .15s; }
.training-session:hover { filter: brightness(.97); box-shadow: 0 3px 10px #25362d20; }
.training-session:focus-visible { outline-offset: 0; position: relative; z-index: 2; }
.training-session--competition { background: #f9e2d6; border-color: #e4b79d; border-left-color: var(--orange); color: #81341e; }
.training-session--autonomy { background: #f1eadb; border-color: #d4c4a2; border-left-color: #8d7040; color: #68502b; }
.training-session__time { font-size: 10px; font-weight: 700; font-variant-numeric: tabular-nums; white-space: nowrap; }
.training-session__audience { font-size: 12px; line-height: 1.25; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; overflow: hidden; }
.training-session__note { font-size: 10px; }
.training-week__empty { padding: 20px 5px; color: var(--muted); text-align: center; font-size: 11px; }
.training-detail { width: min(480px, calc(100% - 32px)); max-height: calc(100dvh - 40px); overflow-y: auto; border: 1px solid var(--line); border-radius: 14px; padding: 28px; background: var(--paper); color: var(--ink); box-shadow: 0 15px 60px #17251b40; }
.training-detail::backdrop { background: #16271e99; backdrop-filter: blur(3px); }
.training-detail header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.training-detail header button { background: transparent; border: 1px solid var(--line); border-radius: 50%; width: 36px; height: 36px; flex-shrink: 0; font-size: 24px; line-height: 1; }
.timetable-section .training-detail h3 { font-size: 28px; letter-spacing: -.04em; margin: 20px 0 10px; }
.training-detail__time { color: var(--orange); font-weight: 700; font-size: 14px; }
.training-detail dl { display: grid; grid-template-columns: 1fr 1.25fr; gap: 14px; margin: 26px 0; font-size: 13px; line-height: 1.6; }
.training-detail dt { color: var(--muted); }.training-detail dd { margin: 0; font-weight: 600; }
.training-detail .fine-print { line-height: 1.7; }
@media (max-width: 1050px) and (min-width: 761px) {
  .training-week__intro { align-items: flex-start; flex-direction: column; gap: 16px; }
  .training-session { padding: 6px 4px; }.training-session__time { font-size: 9px; }.training-session__audience { font-size: 11px; }
}
@media (max-width: 760px) {
  .training-week__intro { flex-direction: column; align-items: flex-start; gap: 18px; }
  .training-week__legend { gap: 10px 14px; }
  .training-week__grid { display: block; padding: 0; border: 0; background: transparent; }
  .training-week__scale { display: none; }
  .training-week__day + .training-week__day { margin-top: 24px; }
  .timetable-section .training-week__day-heading { align-items: flex-start; flex-direction: row; justify-content: space-between; height: auto; margin: 0 0 10px; padding-bottom: 10px; border-bottom: 1px solid var(--line); font-size: 16px; }
  .training-week__day-heading span { font-size: 11px; }
  .training-week__slots { height: auto; border: 0; background: none; display: grid; gap: 8px; }
  .training-week__slot { position: static; width: 100% !important; height: auto !important; padding: 0; }
  .training-session { padding: 14px; flex-direction: row; align-items: center; flex-wrap: wrap; gap: 7px 14px; min-height: 60px; }
  .training-session__time { font-size: 12px; min-width: 95px; }.training-session__audience { font-size: 14px; flex: 1; min-width: 100px; }
  .training-session__note { width: 100%; padding-left: 109px; font-size: 11px; }
  .training-detail { padding: 22px; }
}
</style>
