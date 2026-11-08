import { test } from 'node:test'
import assert from 'node:assert/strict'
import { trainingWeek } from '../shared/training-week.ts'
import type { TrainingSlot } from '../shared/types.ts'

const slot = (day: number, start: string, end: string): TrainingSlot => ({ day, start, end, label: 'Cours', audience: 'Collège', birthYears: '2012–2015', capacity: 14, supervised: true })

test('Une même échelle horaire pour tous les jours, précise à la minute', () => {
  const week = trainingWeek([slot(1, '17:10', '18:05'), slot(6, '09:00', '10:00')])
  assert.equal(week.start, 540)
  assert.equal(week.end, 1140)
  assert.equal(week.days[0]!.slots[0]!.start, 1030)
  assert.equal(week.days[5]!.slots[0]!.start, 540)
  assert.equal(week.hours.at(-1)!.label, '19:00')
})

test('Les séances simultanées ont des colonnes distinctes, les séances qui se suivent partagent leur colonne', () => {
  const week = trainingWeek([slot(3, '09:00', '11:00'), slot(3, '09:30', '10:30'), slot(3, '10:30', '12:00'), slot(3, '12:00', '13:00')])
  const items = week.days[2]!.slots
  assert.equal(items[0]!.lanes, 2)
  assert.equal(items[1]!.lane, items[2]!.lane)
  assert.equal(items[3]!.lanes, 1)
  for (const a of items) for (const b of items) {
    if (a.key !== b.key && a.start < b.end && b.start < a.end) assert.notEqual(a.lane, b.lane)
  }
})

test('Le tri conserve tous les créneaux et ne modifie pas les données Strapi', () => {
  const sessions = [slot(1, '19:00', '21:00'), slot(1, '17:30', '19:00'), slot(7, '10:00', '12:00')]
  const before = JSON.stringify(sessions)
  const week = trainingWeek(sessions)
  assert.equal(JSON.stringify(sessions), before)
  assert.equal(week.days.length, 7)
  assert.equal(week.days[0]!.slots[0]!.slot.start, '17:30')
  assert.equal(week.days.flatMap(day => day.slots).length, sessions.length)
})

test('Une semaine sans cours reste exploitable et sans calcul invalide', () => {
  const week = trainingWeek([])
  assert.equal(week.days.length, 6)
  assert(week.end > week.start)
  assert(week.hours.length > 0)
  assert.equal(week.days.flatMap(day => day.slots).length, 0)
})
