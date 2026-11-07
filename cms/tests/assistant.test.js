const { test } = require('node:test');
const assert = require('node:assert/strict');
const { localTime, validateProposal } = require('../src/plugins/publication-assistant/server/proposal');
const meeting = { start:'2027-05-16T09:00', end:'2027-05-16T17:00', deadline:null, location:'Vertrieu', participationUrl:null, participationLabel:null, allDay:false, eventState:'prévu' };
const proposal = () => ({status:'ready',question:null,title:'Sortie falaise',body:'Prévoir un pique-nique.',category:'Sortie',meeting:{...meeting}});
test('Dates France : hiver, été, journée entière et changements d’heure', () => {
  assert.equal(localTime('2027-01-16T09:00'),'2027-01-16T08:00:00.000Z');
  assert.equal(localTime('2027-05-16T09:00'),'2027-05-16T07:00:00.000Z');
  assert.equal(localTime('2027-05-16T00:00',true),'2027-05-16T00:00:00.000Z');
  for(const value of ['2027-02-30T09:00','2027-03-28T02:30','2027-10-31T02:30','2027-05-16T09:00Z'])assert.throws(()=>localTime(value));
});
test('Seuls les champs éditoriaux attendus sont acceptés', () => {
  assert.equal(validateProposal(proposal()).data.meeting.start,'2027-05-16T07:00:00.000Z');
  assert.throws(()=>validateProposal({...proposal(),publishedAt:new Date().toISOString()}));
  const p=proposal();p.meeting.id=123;assert.throws(()=>validateProposal(p));
  assert.equal(validateProposal({...proposal(),meeting:null}).data.meeting,null);
});
test('Liens dangereux et chronologie incohérente sont rejetés', () => {
  for(const participationUrl of ['javascript:alert(1)','ftp://example.org','https://login:secret@example.org'])assert.throws(()=>validateProposal({...proposal(),meeting:{...meeting,participationUrl}}));
  assert.throws(()=>validateProposal({...proposal(),meeting:{...meeting,end:'2027-05-15T09:00'}}));
  assert.throws(()=>validateProposal({...proposal(),meeting:{...meeting,deadline:'2027-05-17T09:00'}}));
});
test('Une demande ambiguë produit une question sans données à écrire', () => {
  assert.deepEqual(validateProposal({status:'needs_clarification',question:'Quelle date ?',title:'',body:'',category:'Vie du club',meeting:null}),{question:'Quelle date ?'});
  assert.throws(()=>validateProposal({status:'needs_clarification',question:'',title:'',body:'',category:'Vie du club',meeting:null}));
});
