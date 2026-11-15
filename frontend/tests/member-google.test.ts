import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readGoogleFlow} from '../server/utils/member-google.ts';
import {memberReturnPath} from '../shared/member-google.ts';
const state='s'.repeat(43);
const flow={state,nonce:'n'.repeat(43),codeVerifier:'v'.repeat(43),expires:Date.now()+600000,returnPath:'/inscriptions'};
test('Google callback requires the browser state, a valid verifier and an unexpired flow',()=>{
  assert.equal(readGoogleFlow(JSON.stringify(flow),state)?.returnPath,'/inscriptions');
  for(const cookie of [undefined,'bad',JSON.stringify({...flow,expires:0}),JSON.stringify({...flow,nonce:undefined}),JSON.stringify({...flow,codeVerifier:'invalid'}),JSON.stringify({...flow,state:'x'.repeat(43)})])assert.equal(readGoogleFlow(cookie,state),null);
  for(const value of [undefined,[state],state+'x','other'])assert.equal(readGoogleFlow(JSON.stringify(flow),value),null);
});
test('Google redirects stay on the allowed member destinations',()=>{
  for(const value of ['https://evil.invalid','//evil.invalid','/admin','/vie-du-club/../../admin',[],undefined,'/inscriptions?retour=https://evil.invalid'])assert.equal(memberReturnPath(value),'/compte');
  assert.equal(memberReturnPath('/vie-du-club/sortie-2027'),'/vie-du-club/sortie-2027');
  assert.equal(readGoogleFlow(JSON.stringify({...flow,returnPath:'//evil.invalid'}),state)?.returnPath,'/compte');
});
