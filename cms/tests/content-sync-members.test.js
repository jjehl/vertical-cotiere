const {test}=require('node:test');
const assert=require('node:assert/strict');
const model=require('../src/lib/content-sync-members-model');
const row={username:'test.member',email:'member@example.test',role:{type:'contributor'},confirmed:true,blocked:false,password:'$2b$10$'+'a'.repeat(53),firstName:'Camille',lastName:'Test',googleSubject:'private-google-id',resetPasswordToken:'private-reset-token'};
const content=()=>({version:2,type:'members',sourceId:'source',documentId:'member-source',draft:model.dataFromRow(row),published:null,files:[],dependencies:[]});
test('Export membre limité au profil, rôle et hash bcrypt, sans jetons ni connexion Google',()=>{
  const value=content();assert.doesNotThrow(()=>model.validateContent(value));
  assert.equal(value.draft.role,'contributor');assert.equal(value.draft.passwordHash,row.password);
  assert(!JSON.stringify(value).includes('private-'));
  for(const change of [v=>v.draft.role='super-admin',v=>v.draft.passwordHash='plaintext',v=>v.draft.googleSubject='injected',v=>v.draft.membershipBirthDate='2026-02-30',v=>v.files.push({id:1}),v=>v.dependencies.push({}),v=>v.draft.confirmed='true']){
    const bad=content();change(bad);assert.throws(()=>model.validateContent(bad));
  }
});
test('Fusion des profils et mots de passe avec historique sans hash bcrypt réutilisable',()=>{
  const original=content().draft,base=model.snapshot(original);
  assert(!JSON.stringify(base).includes('$2b$'));
  const source={...original,city:'Lyon'},target={...original,phone:'0600000000',passwordHash:'$2b$10$'+'b'.repeat(53)};
  const merged=model.merge(source,base,target,base);
  assert.deepEqual(merged.conflicts,[]);assert.equal(merged.data.city,'Lyon');assert.equal(merged.data.phone,target.phone);assert.equal(merged.data.passwordHash,target.passwordHash);
  const conflict=model.merge({...source,passwordHash:'$2b$10$'+'c'.repeat(53)},base,target,base);
  assert.deepEqual(conflict.conflicts,['passwordHash']);
});
