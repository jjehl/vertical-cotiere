import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dateLabel, canParticipate, parisDay, eventIsInMonth } from '../shared/dates.ts'
import type { ClubEvent } from '../shared/types.ts'

const event: ClubEvent = { slug: 'test', title: 'Test', category: 'Sortie', summary: '', body: '', start: '2026-11-14T15:00:00Z', end: '2026-11-14T17:30:00Z', location: 'Beynost', eventState: 'prévu', participationUrl: 'https://example.com', image: '' }
test('heure de Paris avant et après le passage à l’heure d’hiver', () => {
  assert.equal(dateLabel('2026-10-24T08:00:00Z', { hour: '2-digit', minute: '2-digit' }), '10:00')
  assert.equal(dateLabel('2026-10-25T08:00:00Z', { hour: '2-digit', minute: '2-digit' }), '09:00')
})
test('jour et mois locaux autour de minuit UTC', () => {
  assert.equal(parisDay('2026-10-31T23:30:00Z'), '2026-11-01')
  assert.equal(eventIsInMonth({ ...event, start: '2026-10-31T23:30:00Z' }, '2026-11'), true)
})
test('participation fermée après échéance ou annulation', () => {
  assert.equal(canParticipate(event, new Date('2026-11-01')), true)
  assert.equal(canParticipate(event, new Date('2026-11-15')), false)
  assert.equal(canParticipate({ ...event, eventState: 'annulé' }, new Date('2026-11-01')), false)
  assert.equal(canParticipate({ ...event, deadline: '2026-11-01' }, new Date('2026-11-02')), false)
})
