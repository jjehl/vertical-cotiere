import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCalendar, foldIcalLine } from '../server/utils/ical.ts';
import { eventIsInMonth, eventIsOnDay } from '../shared/dates.ts';
import type { ClubEvent } from '../shared/types.ts';

const event: ClubEvent = { slug:'stage', title:'Stage, falaise; ensemble', category:'Stage', summary:'', body:'Première ligne\nDeuxième ligne', start:'2026-10-19T07:00:00Z', end:'2026-10-20T14:00:00Z', location:'Beynost', eventState:'prévu', image:'', calendarUid:'6510-1792400400-1792512000@www.vertical-cotiere.fr' };
test('un stage multi-jours apparaît chaque jour et dans les mois traversés', () => {
  assert.equal(eventIsOnDay(event,'2026-10-19'), true);
  assert.equal(eventIsOnDay(event,'2026-10-20'), true);
  assert.equal(eventIsOnDay(event,'2026-10-21'), false);
  const crossing = {...event, start:'2026-10-31T10:00:00Z', end:'2026-11-02T10:00:00Z'};
  assert.equal(eventIsInMonth(crossing,'2026-10'),true);
  assert.equal(eventIsInMonth(crossing,'2026-11'),true);
  assert.equal(eventIsInMonth(crossing,'2026-12'),false);
});
test('ICS conserve UID, heures UTC et échappe le contenu', () => {
  const ics=createCalendar([event],'https://club.example',new Date('2026-11-07T12:00:00Z'));
  assert.match(ics,/UID:6510-1792400400-1792512000@www.vertical-cotiere.fr/);
  assert.match(ics,/DTSTART:20261019T070000Z/);
  assert.match(ics,/SUMMARY:Stage\\, falaise\\; ensemble/);
  assert.match(ics,/DESCRIPTION:Première ligne\\nDeuxième ligne/);
  assert.match(ics,/URL:https:\/\/club.example\/vie-du-club\/stage/);
});
test('journée entière : fin exclusive, sans décalage de fuseau', () => {
  const allDay={...event,allDay:true,startDate:'2026-10-10',endDate:'2026-10-11'};
  assert.equal(eventIsOnDay(allDay,'2026-10-10'),true);
  assert.equal(eventIsOnDay(allDay,'2026-10-11'),false);
  const ics=createCalendar([allDay],'https://club.example');
  assert.match(ics,/DTSTART;VALUE=DATE:20261010/);
  assert.match(ics,/DTEND;VALUE=DATE:20261011/);
});
test('repli ICS limité à 75 octets sans couper les caractères UTF-8', () => {
  const line='DESCRIPTION:'+ 'Été en falaise 🧗 '.repeat(20);
  const folded=foldIcalLine(line);
  for(const part of folded.split('\r\n')) assert.ok(Buffer.byteLength(part,'utf8')<=75);
  assert.equal(folded.replace(/\r\n /g,''),line);
});
test('un événement annulé reste dans le flux avec son état', () => {
  assert.match(createCalendar([{...event,eventState:'annulé'}],'https://club.example'),/STATUS:CANCELLED/);
});
