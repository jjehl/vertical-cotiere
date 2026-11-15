const {test}=require('node:test');
const assert=require('node:assert/strict');

test('Les anciennes colonnes gagnent la date une seule fois, sans perdre les préférences',async()=>{
  const {migratePublicationColumns}=await import('../src/admin/publication-columns.mjs');
  const key='STRAPI_LIST_VIEW_DISPLAYED_HEADERS:api::publication.publication:instance';
  const values=new Map([[key,JSON.stringify(['title','date','category'])],['jwtToken','untouched']]);
  const storage={get length(){return values.size;},key:index=>[...values.keys()][index],getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)};
  migratePublicationColumns(storage);
  assert.deepEqual(JSON.parse(values.get(key)),['title','date','eventDate','category']);
  values.set(key,JSON.stringify(['title','date']));
  migratePublicationColumns(storage);
  assert.deepEqual(JSON.parse(values.get(key)),['title','date']);
  assert.equal(values.get('jwtToken'),'untouched');
  assert.doesNotThrow(()=>migratePublicationColumns({get length(){throw Error('disabled');}}));
});
