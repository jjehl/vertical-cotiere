const assert=require('node:assert/strict');
const {mediaKey}=require('../src/lib/content-sync-model');
const {store}=require('../src/lib/content-sync-service');
module.exports=async({app,request,targetToken,publication,photo,bytes})=>{
  const descriptor=publication.files.find(file=>file.id===String(photo.id));
  assert.deepEqual(descriptor.focalPoint,{x:100,y:45});
  const entry=store(app,'media-'+mediaKey(descriptor)),record=await entry.get();
  const files=app.db.query('plugin::upload.file'),before=await files.findOne({where:{id:record.id},populate:{related:true}}),count=await files.count();
  const send=async metadata=>{
    const form=new FormData();form.append('metadata',JSON.stringify(metadata));form.append('files',new Blob([bytes.get(descriptor.id)],{type:descriptor.mime}),descriptor.name);
    return request('files',form,targetToken);
  };
  // Reproduce an image already imported before focalPoint was synchronized.
  await entry.set({value:{id:record.id}});
  await files.update({where:{id:record.id},data:{focalPoint:null}});
  const preview=await request('plan',{publication},targetToken);
  assert.equal(preview.body.action,'update');assert.deepEqual(preview.body.missingFiles.map(file=>file.id),[descriptor.id]);
  assert.equal((await files.findOne({where:{id:record.id}})).focalPoint,null);
  assert.equal((await request('import',{publication},targetToken)).status,409);
  const repaired=await send(descriptor);assert.equal(repaired.status,200,JSON.stringify(repaired.body));assert.equal(repaired.body.id,record.id);assert.equal(repaired.body.reused,true);assert.equal(repaired.body.metadataUpdated,true);
  const after=await files.findOne({where:{id:record.id},populate:{related:true}});
  assert.deepEqual(after.focalPoint,{x:100,y:45});assert.equal(after.url,before.url);assert.deepEqual(after.formats,before.formats);assert.deepEqual(after.related,before.related);assert.equal(await files.count(),count);
  assert.equal((await request('plan',{publication},targetToken)).body.action,'unchanged');
  assert.equal((await send(descriptor)).body.metadataUpdated,false);

  const originalQuery=app.db.query.bind(app.db);
  app.db.query=uid=>{const query=originalQuery(uid);return uid==='strapi::core-store'?{...query,update:async params=>{if(params.data?.value?.includes('sourceFocalPoint')&&params.data.value.includes('"x":75'))throw Error('Simulated focal point persistence failure');return query.update(params);}}:query;};
  try{assert.equal((await send({...descriptor,focalPoint:{x:75,y:40}})).status,500);}finally{app.db.query=originalQuery;}
  assert.deepEqual((await files.findOne({where:{id:record.id}})).focalPoint,descriptor.focalPoint);
  assert.equal((await request('plan',{publication},targetToken)).body.action,'unchanged');

  // A destination-only edit survives; concurrent framing edits are conflicts.
  await files.update({where:{id:record.id},data:{focalPoint:{x:20,y:30}}});
  assert.equal((await request('plan',{publication},targetToken)).body.action,'unchanged');
  assert.equal((await send(descriptor)).body.metadataUpdated,false);
  const changed=structuredClone(publication);changed.files.find(file=>file.id===descriptor.id).focalPoint={x:75,y:40};
  const conflict=await request('plan',{publication:changed},targetToken);assert.equal(conflict.body.action,'conflict');assert(conflict.body.conflicts.some(field=>field.includes('Cadrage')));
  assert.equal((await send({...descriptor,focalPoint:{x:75,y:40}})).status,409);
  const legacy={...descriptor};delete legacy.focalPoint;
  assert.equal((await send(legacy)).status,200);assert.deepEqual((await files.findOne({where:{id:record.id}})).focalPoint,{x:20,y:30});

  // Clearing a source focal point is explicit and does not duplicate the media.
  await files.update({where:{id:record.id},data:{focalPoint:descriptor.focalPoint}});
  assert.equal((await send({...descriptor,focalPoint:null})).status,200);
  assert.equal((await files.findOne({where:{id:record.id}})).focalPoint,null);
  assert.equal((await send(descriptor)).status,200);assert.equal(await files.count(),count);
  console.log('OK cadrages : export, import initial, réparation des médias existants sans doublon, aperçu, relance, effacement, anciens exports, rollback et conflits entre environnements.');
};
