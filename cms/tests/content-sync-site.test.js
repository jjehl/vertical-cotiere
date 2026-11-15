const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../src/lib/content-sync-site-model');
const slot={registrationCode:'monday',label:'Lundi',day:'Lundi',start:'17:00:00.000',end:'19:00:00.000',audience:'Adultes',birthYears:null,capacity:20,supervised:true,registrationEnabled:true,occupiedPlaces:0,priceCents:20000,ccmpPriceCents:19000,familyPriceCents:18000,ccmpFamilyPriceCents:17000};
const timetable={season:'2026–2027',note:'Planning',registrationsOpen:true,registrationOpensAt:'2026-05-27T22:00:00.000Z',sessions:[slot],ufraps:{opens:'2026-09-01',closes:'2027-06-30',day:'Samedi',start:'10:00:00.000',end:'12:00:00.000',closures:[],closedDays:[]},attachments:[]};
const envelope=data=>({version:2,type:'timetable',sourceId:'source',documentId:'planning',draft:data,published:null,files:[],dependencies:[]});
test('Export du planning : tarifs, capacités, inscriptions et calendrier sans identifiants de composants',()=>{
  const row={...structuredClone(timetable),id:42,sessions:[{...slot,id:4}],ufraps:{...timetable.ufraps,id:7,closedDays:[{id:9,date:'2027-05-01',label:'Férié'}]}};
  const data=model.dataFromRow('timetable',row);
  assert.equal(data.sessions[0].id,undefined);assert.equal(data.ufraps.id,undefined);assert.equal(data.ufraps.closedDays[0].id,undefined);
  assert.equal(data.sessions[0].ccmpFamilyPriceCents,17000);assert.doesNotThrow(()=>model.validateContent(envelope(data)));
});
test('Refus des collections privées, champs supplémentaires, montants invalides et composants injectés',()=>{
  for(const change of [value=>value.type='course-registration',value=>value.draft.secret='secret',value=>value.draft.sessions[0].id=123,value=>value.draft.sessions[0].priceCents=-100,value=>value.draft.ufraps.closedDays=[{date:'2027-02-30',label:'Invalide'}],value=>value.draft.ufraps.closedDays=[{date:'2027-02-28',label:'Valide',private:'secret'}],value=>value.draft.sessions.push({...slot})]){
    const value=envelope(structuredClone(timetable));change(value);assert.throws(()=>model.validateContent(value));
  }
});
test('Fusion des tarifs par identifiant de cours sans écraser la capacité modifiée en cible',()=>{
  const source=structuredClone(timetable),target=structuredClone(timetable);source.sessions[0].priceCents=21000;target.sessions[0].capacity=25;
  const result=model.mergeVersion('timetable',source,timetable,target,timetable,source);
  assert.deepEqual(result.conflicts,[]);assert.equal(result.data.sessions[0].priceCents,21000);assert.equal(result.data.sessions[0].capacity,25);
  const next=structuredClone(source);next.sessions[0].capacity=30;
  const conflict=model.mergeVersion('timetable',next,source,result.data,result.baseline,next);
  assert.deepEqual(conflict.conflicts,['sessions.monday.capacity']);
});
test('Les cours supplémentaires de la cible sont conservés et les suppressions concurrentes signalées',()=>{
  const target=structuredClone(timetable);target.sessions.push({...slot,registrationCode:'target-only'});
  assert.equal(model.mergeVersion('timetable',timetable,timetable,target,timetable,timetable).data.sessions.length,2);
  assert.deepEqual(model.mergeVersion('timetable',timetable,timetable,{...timetable,sessions:[]},timetable,timetable).conflicts,['sessions.monday']);
});
test('Les documents liés et médias sont remappés indépendamment des identifiants source',()=>{
  const value={title:'Page',slug:'page',bodyHtml:'<img src="/media/1"> https://autre.test/media/1',group:null,oldPath:null,sourceId:null,attachments:['1'],documents:['source-document']};
  const mapped=model.mapData('pages',value,new Map([['1','42']]),new Map([['source-document','target-document']]));
  assert.deepEqual(mapped.documents,['target-document']);assert.deepEqual(mapped.attachments,['42']);assert.equal(mapped.bodyHtml,'<img src="/media/42"> https://autre.test/media/1');
  assert.notEqual(model.key({type:'pages',sourceId:'source',documentId:'x'}),model.key({type:'activities',sourceId:'source',documentId:'x'}));
});
