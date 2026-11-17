const {test}=require('node:test');
const assert=require('node:assert/strict');
const {mergeVersion,equal,mapData,fields,validatePublication,mediaKey}=require('../src/lib/content-sync-model');
const base={title:'Sortie',slug:'sortie',body:'Initial',category:'Sortie',meeting:null,photos:['1'],attachments:[],coverImage:'1'};
test('Le contrat média valide un cadrage optionnel sans changer l’identité du fichier',()=>{
  const file={id:'1',name:'photo.jpg',mime:'image/jpeg',alternativeText:'',caption:'',sha256:'a'.repeat(64)};
  const content={version:1,sourceId:'source',documentId:'publication',draft:{...Object.fromEntries(fields.map(key=>[key,null])),...base},published:null,files:[file]};
  assert.doesNotThrow(()=>validatePublication(content));
  for(const focalPoint of [null,{x:100,y:45},{x:0,y:0}]){
    const value=structuredClone(content);value.files[0].focalPoint=focalPoint;
    assert.doesNotThrow(()=>validatePublication(value));assert.equal(mediaKey(value.files[0]),mediaKey(file));
  }
  for(const focalPoint of [{x:-1,y:45},{x:101,y:45},{x:'100',y:45},{x:100},{x:100,y:45,extra:true},{x:NaN,y:45},[100,45],false]){
    const value=structuredClone(content);value.files[0].focalPoint=focalPoint;
    assert.throws(()=>validatePublication(value),/point de cadrage/);
  }
});
test('Fusion des champs indépendants et conservation des fichiers ajoutés en recette',()=>{
  const result=mergeVersion({...base,title:'Sortie locale',photos:['1','2']},base,{...base,body:'Ajout recette',photos:['1','3']},base,{...base,title:'Sortie locale',photos:['1','2']});
  assert.deepEqual(result.conflicts,[]);assert.equal(result.data.title,'Sortie locale');assert.equal(result.data.body,'Ajout recette');
  assert.deepEqual(result.data.photos,['1','2','3']);
  // A later source edit must still conflict with a destination edit never reconciled at source.
  const next=mergeVersion({...base,title:'Sortie locale',body:'Ajout local'}, {...base,title:'Sortie locale'},result.data,result.baseline,{...base,title:'Sortie locale',body:'Ajout local'});
  assert(next.conflicts.includes('body'));
});
test('Un conflit ne remplace pas le champ modifié sur les deux sites',()=>{
  const result=mergeVersion({...base,body:'Local'},base,{...base,body:'Recette'},base,{...base,body:'Local'});
  assert.deepEqual(result.conflicts,['body']);assert.equal(result.data.body,'Recette');
});
test('Suppression locale de médias et dépublication ne suppriment pas la destination',()=>{
  const result=mergeVersion({...base,photos:[]},base,base,base,{...base,photos:[]});
  assert.deepEqual(result.data.photos,['1']);
  assert(equal(mergeVersion(null,base,base,base,null).data,base));
});
test('Une version publiée retirée en recette est signalée si la source veut la modifier',()=>{
  assert.deepEqual(mergeVersion({...base,title:'Nouveau'},base,null,base,{...base,title:'Nouveau'}).conflicts,['état de publication']);
});
test('Les liens internes changent d’identifiants et les liens externes restent intacts',()=>{
  const data={...base,body:'[image](/media/1?variant=thumbnail) https://autre.test/media/1',legacyBody:null,legacyHtml:'<img src="/media/1">'};
  const mapped=mapData(data,new Map([['1','42']]));
  assert.equal(mapped.body,'[image](/media/42?variant=thumbnail) https://autre.test/media/1');
  assert.equal(mapped.legacyHtml,'<img src="/media/42">');
});
