const {test}=require('node:test');
const assert=require('node:assert/strict');
const {categories,normalizeCategory}=require('../src/lib/publication-categories');
const {validateProposal}=require('../src/plugins/publication-assistant/server/proposal');

test('Les anciennes rubriques sont regroupées parmi les cinq catégories',()=>{
  for(const category of categories)assert.equal(normalizeCategory(category),category);
  for(const value of ['Compétitions',"Compétitions, Coupe de l’Ain, Officiel"])assert.equal(normalizeCategory(value),'Compétition');
  for(const value of ['Falaises, Sorties','Compte-rendu, Randonnée, Sorties'])assert.equal(normalizeCategory(value),'Sortie');
  for(const value of ['',null,'Non classé','Bon plan','Obsolète'])assert.equal(normalizeCategory(value),'Vie du club');
});

test('L’assistant refuse toute autre catégorie, même si elle existait auparavant',()=>{
  const proposal={status:'ready',question:null,title:'Sortie',body:'Texte',category:'Sortie',meeting:null};
  for(const category of categories)assert.equal(validateProposal({...proposal,category}).data.category,category);
  for(const category of [null,'','Autre','Compétitions'])assert.throws(()=>validateProposal({...proposal,category},{existingCategory:category}),/Rubrique invalide/);
});
