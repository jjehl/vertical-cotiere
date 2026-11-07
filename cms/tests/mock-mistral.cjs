// Explicitly isolated HTTP tests only; never enabled in normal Compose or images.
if(process.env.RUN_ASSISTANT_TESTS!=='true'||process.env.MISTRAL_API_KEY!=='mistral-test-key')throw new Error('Mock Mistral réservé à la recette isolée.');
const realFetch=globalThis.fetch;
globalThis.fetch=async(input,options)=>{
  if(String(input)!=='https://api.mistral.ai/v1/chat/completions')return realFetch(input,options);
  const assert=require('node:assert/strict');
  const request=JSON.parse(options.body);
  assert.equal(options.headers.Authorization,'Bearer mistral-test-key');
  assert.equal(request.response_format.type,'json_schema');
  assert.equal(request.response_format.json_schema.strict,true);
  const instruction=request.messages.at(-1).content;
  if(instruction.includes('TEST_UNAVAILABLE'))return new Response('{}',{status:429});
  if(instruction.includes('TEST_TIMEOUT'))throw new Error('Simulated timeout');
  if(instruction.includes('TEST_MALFORMED'))return Response.json({choices:[{finish_reason:'stop',message:{content:'not JSON'}}]});
  let proposal={status:'ready',question:null,title:instruction.includes('TEST_UI')?'Sortie proposée depuis l’assistant':'Sortie de recette IA',body:'Une sortie à Vertrieu. Prévoir un pique-nique.',category:'Sortie',meeting:{start:'2027-05-16T09:00',end:'2027-05-16T17:00',location:'Vertrieu',participationUrl:null,participationLabel:null,deadline:null,allDay:false,eventState:'prévu'}};
  if(instruction.includes('TEST_CLARIFY'))proposal={status:'needs_clarification',question:'Quelle est la date de la sortie ?',title:'',body:'',category:'Vie du club',meeting:null};
  if(instruction.includes('TEST_INVALID_DATE'))proposal.meeting.start='2027-03-28T02:30';
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(proposal)}}]});
};
