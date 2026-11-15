const {test}=require('node:test');
const assert=require('node:assert/strict');
const editor=require('../src/lib/publication-editor');
const migrate=require('../src/lib/migrate-publication-event-date');
const uid='api::publication.publication';
const start='2027-05-16T07:00:00.000Z';
const later='2027-05-17T07:00:00.000Z';

test('La date triable suit la création, le report et le retrait du rendez-vous', async()=>{
  let previous=null;
  const strapi={documents:()=>({findOne:async()=>previous,findFirst:async()=>null})};
  async function edit(data) {
    const context={uid,action:previous?'update':'create',params:{...(previous?{documentId:'test'}:{}),data}};
    await editor(context,async()=>{},strapi);
    previous={...previous,...context.params.data};
    return previous;
  }
  assert.equal((await edit({title:'Information',eventDate:start})).eventDate,null);
  assert.equal((await edit({meeting:{start}})).eventDate,start);
  assert.equal((await edit({body:'Texte corrigé',eventDate:later})).eventDate,start);
  assert.equal((await edit({meeting:{start:later}})).eventDate,later);
  assert.equal((await edit({meeting:null})).eventDate,null);
});

test('Publier synchronise une date manquante avant la publication', async()=>{
  const previous={title:'Sortie',slug:'sortie',date:start,meeting:{start},eventDate:null};
  const updates=[];
  const strapi={documents:()=>({findOne:async()=>previous,update:async params=>updates.push(params)})};
  await editor({uid,action:'publish',params:{documentId:'test'}},async()=>{
    assert.equal(updates.length,1);
    assert.deepEqual(updates[0],{documentId:'test',data:{eventDate:start}});
  },strapi);
});

test('La reprise conserve les dates distinctes des brouillons et versions publiées',async()=>{
  const rows=[{id:1,meeting:{start},updatedAt:'2026-01-01'},
    {id:2,meeting:{start:later},updatedAt:'2026-02-01'},
    {id:3,meeting:null,updatedAt:'2026-03-01'}];
  const updates=[];
  let marker=false;
  const strapi={
    store:()=>({get:async()=>marker,set:async({value})=>{marker=value;}}),
    db:{query:()=>({findMany:async()=>rows}),metadata:{get:()=>({tableName:'publications',attributes:{eventDate:{columnName:'event_date'}}})},
      connection:{transaction:async callback=>callback(table=>({where:({id})=>({update:async data=>updates.push({table,id,data})})}))}},
  };
  await migrate(strapi);
  assert.deepEqual(updates,rows.map((row,index)=>({table:'publications',id:row.id,data:{event_date:[start,later,null][index]}})));
  await migrate(strapi);
  assert.equal(updates.length,3);
});
