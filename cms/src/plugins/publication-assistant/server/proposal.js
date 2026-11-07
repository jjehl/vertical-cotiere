// Pure validation: never trust a schema-conforming model response as application data.
const states = ['prévu', 'complet', 'annulé', 'reporté'];
const categories = ['Cours', 'Compétition', 'Sortie', 'Stage', 'Vie du club'];
const nullableString = { type: ['string', 'null'] };
const meetingProperties = {
  start: { type: 'string' }, end: nullableString, location: nullableString,
  participationUrl: nullableString, participationLabel: nullableString, deadline: nullableString,
  allDay: { type: 'boolean' }, eventState: { type: 'string', enum: states },
};
const schema = {
  type: 'object', additionalProperties: false,
  properties: {
    status: { type: 'string', enum: ['ready', 'needs_clarification'] }, question: nullableString,
    title: { type: 'string' }, body: { type: 'string' },
    category: { type:'string', enum:categories },
    meeting: { type: ['object', 'null'], additionalProperties: false, properties: meetingProperties, required: Object.keys(meetingProperties) },
  }, required: ['status', 'question', 'title', 'body', 'category', 'meeting'],
};
const paris = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
function localTime(value, allDay = false) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Date invalide : préciser une date et une heure.');
  const naive = Date.parse(value + ':00Z');
  if (!Number.isFinite(naive) || new Date(naive).toISOString().slice(0,16) !== value) throw new Error('Cette date n’existe pas.');
  if (allDay) {
    if (!value.endsWith('T00:00')) throw new Error('Une journée entière doit commencer à minuit.');
    return new Date(naive).toISOString(); // Site convention: UTC date for all-day events.
  }
  const candidates = [60, 120].map(offset => new Date(naive - offset * 60000))
    .filter(date => paris.format(date).replace(' ', 'T') === value);
  if (candidates.length !== 1) throw new Error('Heure ambiguë ou inexistante lors du changement d’heure : choisir une autre heure.');
  return candidates[0].toISOString();
}
function text(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error('Le texte proposé est vide ou trop long.');
  return value.trim();
}
function exactKeys(object, keys) {
  if (!object || typeof object !== 'object' || Array.isArray(object) || Object.keys(object).some(key => !keys.includes(key)) || keys.some(key => !(key in object))) throw new Error('Réponse structurée invalide.');
}
function validateProposal(input) {
  exactKeys(input, Object.keys(schema.properties));
  if (!['ready', 'needs_clarification'].includes(input.status)) throw new Error('Réponse structurée invalide.');
  if (input.status === 'needs_clarification') return { question: text(input.question, 1500, true) };
  if (input.question !== null) throw new Error('Une demande de précision reste à résoudre.');
  if (!categories.includes(input.category)) throw new Error('Rubrique invalide.');
  const data = { title: text(input.title, 200, true), body: text(input.body, 12000, true), category: input.category, meeting: null };
  if (input.meeting !== null) {
    const m = input.meeting;
    exactKeys(m, Object.keys(meetingProperties));
    if (typeof m.allDay !== 'boolean' || !states.includes(m.eventState)) throw new Error('Rendez-vous invalide.');
    const meeting = { start: localTime(m.start, m.allDay), allDay: m.allDay, eventState: m.eventState };
    for (const key of ['end', 'deadline']) if (m[key] !== null) meeting[key] = localTime(m[key], key === 'end' && m.allDay);
    for (const key of ['location', 'participationUrl', 'participationLabel']) if (m[key] !== null) meeting[key] = text(m[key], key === 'participationUrl' ? 2000 : 250);
    if (meeting.participationUrl) {
      let url; try { url = new URL(meeting.participationUrl); } catch { throw new Error('Lien de participation invalide.'); }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('Lien de participation invalide.');
    }
    if (meeting.end && meeting.end < meeting.start) throw new Error('La fin précède le début du rendez-vous.');
    if (meeting.deadline && meeting.deadline > (meeting.end || meeting.start)) throw new Error('La clôture des inscriptions doit précéder la fin du rendez-vous.');
    data.meeting = meeting;
  }
  return { data };
}
module.exports = { schema, validateProposal, localTime };
