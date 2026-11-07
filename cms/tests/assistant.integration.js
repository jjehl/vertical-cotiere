const assert=require('node:assert/strict');
const {randomBytes}=require('node:crypto');
const {createStrapi}=require('@strapi/strapi');
if(process.env.RUN_ASSISTANT_TESTS!=='true'||process.env.MISTRAL_API_KEY!=='mistral-test-key')throw new Error('Utiliser uniquement le Compose assistant de recette.');
const base='http://127.0.0.1:1337';
const uid='api::publication.publication';
(async()=>{
  const app=await createStrapi().load();
  const publications=app.documents(uid);
  const createdDocuments=[], createdPhotos=[], createdUsers=[], createdRoles=[];
  const password=randomBytes(24).toString('base64url')+'aA1!';
  const email='assistant-'+randomBytes(5).toString('hex')+'@local.invalid';
  async function request(path,body,token,method=body?'POST':'GET') {
    const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
    return {status:response.status,body:await response.json()};
  }
  async function login(email) {
    const response=await request('/admin/login',{email,password});
    assert.equal(response.status,200);assert(response.body.data.token);return response.body.data.token;
  }
  async function adminWithRole(name,permissions) {
    const role=await app.service('admin::role').create({name:name+'-'+randomBytes(5).toString('hex'),description:'Recette assistant',code:'assistant-'+randomBytes(5).toString('hex')});
    createdRoles.push(role.id);
    await app.service('admin::role').assignPermissions(role.id,permissions);
    const address=name+'-'+email;
    const user=await app.service('admin::user').create({email:address,password,firstname:'Recette',lastname:name,isActive:true,roles:[role.id]});createdUsers.push(user.id);
    return login(address);
  }
  const perm=(action,subject,properties={})=>({action,subject,properties,conditions:[]});
  try {
    // Existing super-admin may already exist after a previous run; never overwrite it.
    const superRole=await app.db.query('admin::role').findOne({where:{code:'strapi-super-admin'}});
    const user=await app.service('admin::user').create({email,password,firstname:'Recette',lastname:'Assistant',isActive:true,roles:[superRole.id]});createdUsers.push(user.id);
    const token=await login(email);
    assert([401,403].includes((await request('/publication-assistant/status')).status));
    const status=await request('/publication-assistant/status',null,token);
    assert.equal(status.status,200);assert.equal(status.body.configured,true);assert(!JSON.stringify(status.body).includes('mistral-test-key'));
    const noPlugin=await adminWithRole('sans-plugin',[]);
    assert.equal((await request('/publication-assistant/prepare',{instruction:'Sortie'},noPlugin)).status,403);
    const noCreate=await adminWithRole('sans-creation',[perm('plugin::publication-assistant.use',null)]);
    assert.equal((await request('/publication-assistant/prepare',{instruction:'Sortie'},noCreate)).status,403);
    const imageBytes=await require('sharp')({create:{width:24,height:18,channels:3,background:'#dc5538'}}).png().toBuffer();
    const form=new FormData();form.append('files',new Blob([imageBytes],{type:'image/png'}),'assistant-test.png');
    const uploaded=await fetch(base+'/upload',{method:'POST',headers:{Authorization:'Bearer '+token},body:form});
    assert.equal(uploaded.status,201);const [image]=await uploaded.json();assert(image.id);createdPhotos.push(image);
    const draftOnly=await adminWithRole('brouillon',[
      perm('plugin::publication-assistant.use',null),
      perm('plugin::content-manager.explorer.create',uid,{fields:['title','body','category','photos','meeting','meeting.start','meeting.end','meeting.location','meeting.allDay','meeting.eventState']}),
    ]);
    const titleOnly=await adminWithRole('titre-seul',[
      perm('plugin::publication-assistant.use',null),perm('plugin::content-manager.explorer.create',uid,{fields:['title']}),
    ]);
    assert.equal((await request('/publication-assistant/prepare',{instruction:'TEST_FIELDS'},titleOnly)).status,403);
    const count=()=>app.db.query(uid).count();
    const before=await count();
    const clarify=await request('/publication-assistant/prepare',{instruction:'TEST_CLARIFY'},token);
    assert.equal(clarify.status,200);assert(clarify.body.question);assert(!clarify.body.previewId);
    for(const instruction of ['TEST_MALFORMED','TEST_INVALID_DATE'])assert.equal((await request('/publication-assistant/prepare',{instruction},token)).status,422);
    for(const instruction of ['TEST_UNAVAILABLE','TEST_TIMEOUT'])assert.equal((await request('/publication-assistant/prepare',{instruction},token)).status,502);
    assert.equal((await request('/publication-assistant/prepare',{instruction:'Sortie',photos:[1]},token)).status,403);
    const proposal=await request('/publication-assistant/prepare',{instruction:'TEST_VALID sortie le 16 mai 2027',photos:[image.id]},token);
    assert.equal(proposal.status,200,JSON.stringify(proposal.body));assert.equal(await count(),before);
    assert.equal(proposal.body.data.meeting.start,'2027-05-16T07:00:00.000Z');
    const pending=await request('/publication-assistant/prepare',{instruction:'TEST_DRAFT'},draftOnly);
    assert.equal(pending.status,200,JSON.stringify(pending.body));assert.equal(pending.body.canPublish,false);
    assert.equal((await request('/publication-assistant/prepare',{instruction:'Photo étrangère',photos:[image.id]},draftOnly)).status,403);
    assert.equal((await request('/publication-assistant/confirm',{previewId:pending.body.previewId,mode:'publish'},draftOnly)).status,403);
    assert.equal((await request('/publication-assistant/confirm',{previewId:proposal.body.previewId,mode:'draft'},draftOnly)).status,410);
    assert.equal((await request('/publication-assistant/confirm',{previewId:'expired',mode:'draft'},token)).status,410);
    const draft=await request('/publication-assistant/confirm',{previewId:pending.body.previewId,mode:'draft'},draftOnly);
    if(draft.body.documentId)createdDocuments.push(draft.body.documentId);
    assert.equal(draft.status,200,JSON.stringify(draft.body));assert.equal(draft.body.published,false);
    assert.equal(await publications.findOne({documentId:draft.body.documentId,status:'published'}),null);
    const confirmed=await request('/publication-assistant/confirm',{previewId:proposal.body.previewId,mode:'publish',data:{title:'CLIENT TAMPERING'}},token);
    if(confirmed.body.documentId)createdDocuments.push(confirmed.body.documentId);
    assert.equal(confirmed.status,200,JSON.stringify(confirmed.body));assert.equal(confirmed.body.published,true);
    const published=await publications.findOne({documentId:confirmed.body.documentId,status:'published',populate:{meeting:true,photos:true}});
    assert.equal(published.title,'Sortie de recette IA');assert.equal(published.meeting.start,'2027-05-16T07:00:00.000Z');
    assert.deepEqual(published.photos.map(photo=>photo.id),[image.id]);
    const retry=await request('/publication-assistant/confirm',{previewId:proposal.body.previewId,mode:'publish'},token);
    assert.deepEqual(retry.body,confirmed.body);assert.equal(await count(),before+3);
    const publicData=await request('/api/site-content');
    assert(publicData.body.events.some(event=>event.title==='Sortie de recette IA'));
    assert(!JSON.stringify(publicData.body).includes('mistral-test-key'));
    // Leave credentials only in test process memory; UI tests create their own user.
    console.log('Assistant : authentification, rôles, validation IA, dates, aperçu sans écriture, brouillon, publication agenda et confirmation idempotente vérifiés.');
  } finally {
    try {
      for(const documentId of createdDocuments)await publications.delete({documentId});
      for(const image of createdPhotos)await app.plugin('upload').service('upload').remove(image);
      for(const id of createdUsers)await app.db.query('admin::user').delete({where:{id}});
      if(createdRoles.length)await app.service('admin::role').deleteByIds(createdRoles);
    } finally { await app.destroy(); }
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
