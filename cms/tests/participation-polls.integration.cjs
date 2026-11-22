const assert=require('node:assert/strict');

module.exports=async function testParticipationPolls({app,request,user,token,other,otherToken,basic,contributor,docs,unpublished}) {
  const users=app.plugin('users-permissions').service('user');
  const future=days=>new Date(Date.now()+days*86400000).toISOString();
  const meeting={start:future(2),end:future(3),deadline:null,eventState:'prévu',allDay:false};
  const event=await docs.create({data:{title:'Rendez-vous avec sondage',body:'Texte public du rendez-vous.',category:'Sortie',meeting},status:'published'});
  await docs.update({documentId:event.documentId,data:{body:'Modification encore en brouillon.'}});
  const beforeDraft=await docs.findOne({documentId:event.documentId,populate:{meeting:true}});
  const beforePublic=await docs.findOne({documentId:event.documentId,status:'published',populate:{meeting:true}});
  const path='/api/member/publications/'+event.slug+'/poll';
  assert.equal((await request('/api/publications/'+event.slug)).body.hasParticipationPoll,false);
  for(const [suffix,body] of [['',null],['',{}],['/register',{confirmed:true}]])assert([401,403].includes((await request(path+suffix,body)).status));
  await users.edit(other.id,{role:basic.id});
  assert.equal((await request(path,{},otherToken)).status,403);
  const empty=await request(path,null,otherToken);assert.equal(empty.status,200);assert.equal(empty.body.exists,false);
  assert.deepEqual(empty.body.participants,[]);
  await users.edit(other.id,{role:contributor.id});
  const creations=await Promise.all([request(path,{},token),request(path,{},otherToken)]);
  for(const result of creations){assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.exists,true);}
  assert.equal(await app.db.query('api::participation-poll.participation-poll').count({where:{publicationDocumentId:event.documentId}}),1);
  await users.edit(other.id,{role:basic.id});
  for(const body of [{},{confirmed:false},{confirmed:'true'},{confirmed:true,member:user.id}])assert.equal((await request(path+'/register',body,otherToken)).status,400);
  const registrations=await Promise.all([
    request(path+'/register',{confirmed:true},otherToken),
    request(path+'/register',{confirmed:true},otherToken),
    request(path+'/register',{confirmed:true},token),
  ]);
  for(const result of registrations){assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.registered,true);}
  const listed=await request(path,null,otherToken);
  assert.equal(listed.body.participants.length,2);
  assert.deepEqual(listed.body.participants.find(item=>item.isCurrentMember),{name:'Alex TEST',isCurrentMember:true});
  assert.deepEqual(new Set(listed.body.participants.map(item=>item.name)),new Set(['Camille MARTIN','Alex TEST']));
  assert(!JSON.stringify(listed.body).includes('@local.invalid'));assert(!JSON.stringify(listed.body).includes('000123456'));
  const poll=await app.db.query('api::participation-poll.participation-poll').findOne({where:{publicationDocumentId:event.documentId}});
  const saved=await app.db.query('api::event-participation.event-participation').findMany({where:{poll:poll.id},populate:{member:true,registeredByMember:true}});
  assert.equal(saved.length,2);assert(saved.every(row=>row.confirmedAt&&row.registrationKey));
  assert(saved.every(row=>row.registeredByMember.id===row.member.id));
  assert.deepEqual(await docs.findOne({documentId:event.documentId,populate:{meeting:true}}),beforeDraft);
  assert.deepEqual(await docs.findOne({documentId:event.documentId,status:'published',populate:{meeting:true}}),beforePublic);
  const publicPage=(await request('/api/publications/'+event.slug)).body;
  assert.equal(publicPage.hasParticipationPoll,true);
  assert(!JSON.stringify(publicPage).includes('Alex TEST'));assert(!JSON.stringify(publicPage).includes('Camille MARTIN'));
  assert(!JSON.stringify(publicPage).includes('participants'));
  const publicContent=(await request('/api/site-content')).body;
  assert(!JSON.stringify(publicContent).includes('participants'));
  for(const generic of ['/api/participation-polls','/api/event-participations'])assert([401,403,404].includes((await request(generic,null,token)).status));
  await users.edit(other.id,{blocked:true});
  assert([401,403].includes((await request(path,null,otherToken)).status));
  assert([401,403].includes((await request(path+'/register',{confirmed:true},otherToken)).status));
  await users.edit(other.id,{blocked:false,role:contributor.id});
  for(const slug of [unpublished.slug,'rendez-vous-introuvable']) {
    const missing='/api/member/publications/'+slug+'/poll';
    assert.equal((await request(missing,null,token)).status,404);
    assert.equal((await request(missing,{},token)).status,404);
    assert.equal((await request(missing+'/register',{confirmed:true},token)).status,404);
  }
  const noMeeting=await docs.create({data:{title:'Sans rendez-vous',category:'Vie du club'},status:'published'});
  assert.equal((await request('/api/member/publications/'+noMeeting.slug+'/poll',{},token)).status,404);
  await docs.unpublish({documentId:event.documentId});
  assert.equal((await request(path,null,token)).status,404);
  assert.equal((await request(path+'/register',{confirmed:true},token)).status,404);
  await docs.publish({documentId:event.documentId});
  assert.equal((await request(path,null,token)).body.participants.length,2);
  for(const closed of [
    {...meeting,eventState:'annulé'},
    {...meeting,eventState:'complet'},
    {...meeting,eventState:'reporté'},
    {...meeting,deadline:future(-1)},
    {...meeting,start:future(-3),end:future(-2)},
  ]) {
    await docs.update({documentId:event.documentId,status:'published',data:{meeting:closed}});
    const result=await request(path,null,token);assert.equal(result.body.open,false);assert.equal(result.body.participants.length,2);
    assert.equal((await request(path+'/register',{confirmed:true},token)).status,400);
    assert.equal((await request(path,{},token)).status,400);
  }
  // All-day end dates include their last day, using the same Paris dates as the agenda.
  const {registrationsOpen}=require('../src/lib/participation-polls');
  const allDay={documentId:'test',meeting:{start:'2027-03-28T00:00:00+01:00',end:'2027-03-28T00:00:00+01:00',allDay:true,eventState:'prévu'}};
  assert.equal(registrationsOpen(allDay,new Date('2027-03-28T23:59:59+02:00')),true);
  assert.equal(registrationsOpen(allDay,new Date('2027-03-29T00:00:00+02:00')),false);
  await docs.update({documentId:event.documentId,status:'published',data:{meeting}});
  const participantSearch=await testDelegatedRegistrations({app,request,user,token,other,otherToken,basic,contributor,docs,meeting});
  console.log('OK : sondages, permissions, confirmation obligatoire, identité serveur, doublons concurrents, confidentialité, brouillons, dépublication et clôture des inscriptions.');
  const creationEvent=await docs.create({data:{title:'Rendez-vous à organiser',category:'Sortie',meeting},status:'published'});
  return {pollSlug:event.slug,pollCreationSlug:creationEvent.slug,participantSearch};
};

async function testDelegatedRegistrations({app,request,user,token,other,otherToken,basic,contributor,docs,meeting}) {
  const users=app.plugin('users-permissions').service('user');
  let next=0;
  const add=data=>{const email='participant-'+(++next)+'@local.invalid';return users.add({username:email,email,password:'Participant-test-123456789!',provider:'local',confirmed:true,role:basic.id,...data});};
  const target=await add({firstName:'Zoé',lastName:'Durand'});
  const blocked=await add({firstName:'SecretBloqué',lastName:'Durand',blocked:true});
  const unconfirmed=await add({firstName:'SecretInactif',lastName:'Durand',confirmed:false});
  const concurrent=await add({firstName:'Nina',lastName:'Concurrente'});
  const event=await docs.create({data:{title:'Inscriptions par un autre membre',category:'Sortie',meeting},status:'published'});
  const path='/api/member/publications/'+event.slug+'/poll';
  const search=q=>path+'/members?q='+encodeURIComponent(q);
  assert.equal((await request(search('Durand'),null,token)).status,404);
  assert.equal((await request(path,{},token)).status,200);
  assert([401,403].includes((await request(search('Durand'))).status));
  await users.edit(other.id,{role:basic.id});
  for(const text of ['z','DUR','uran','Durand Zoé']) {
    const result=await request(search(text),null,otherToken);assert.equal(result.status,200,JSON.stringify(result.body));
    assert(result.body.members.some(member=>member.id===target.id));
    assert(!result.body.members.some(member=>[blocked.id,unconfirmed.id].includes(member.id)));
    assert(result.body.members.every(member=>Object.keys(member).sort().join(',')==='id,name,registered'));
  }
  for(const text of ['',' ','123','a'.repeat(81)])assert.equal((await request(search(text),null,otherToken)).status,400);
  assert.deepEqual((await request(search('AucunMembreDeCeNom'),null,otherToken)).body,{members:[],hasMore:false});
  for(const memberId of [0,-1,'1',true,1.1])assert.equal((await request(path+'/register',{confirmed:true,memberId},otherToken)).status,400);
  for(const memberId of [blocked.id,unconfirmed.id,999999])assert.equal((await request(path+'/register',{confirmed:true,memberId},otherToken)).status,404);
  assert.equal((await request(path+'/register',{confirmed:true,memberId:target.id,registeredByMember:user.id},otherToken)).status,400);
  assert.equal((await request(path+'/register',{confirmed:false,memberId:target.id},otherToken)).status,400);
  const registered=await request(path+'/register',{confirmed:true,memberId:target.id},otherToken);
  assert.equal(registered.status,200,JSON.stringify(registered.body));assert.equal(registered.body.registered,false);
  assert.deepEqual(registered.body.participants,[{name:'Zoé DURAND',isCurrentMember:false}]);
  const poll=await app.db.query('api::participation-poll.participation-poll').findOne({where:{publicationDocumentId:event.documentId}});
  const participations=app.db.query('api::event-participation.event-participation');
  const saved=()=>participations.findOne({where:{poll:poll.id,member:target.id},populate:{registeredByMember:{select:['id']},member:{select:['id']}}});
  const original=await saved();assert.equal(original.member.id,target.id);assert.equal(original.registeredByMember.id,other.id);
  const found=(await request(search('Durand'),null,otherToken)).body.members.find(member=>member.id===target.id);assert.equal(found.registered,true);
  const targetToken=app.plugin('users-permissions').service('jwt').issue({id:target.id});
  assert.equal((await request(path+'/register',{confirmed:true},targetToken)).body.registered,true);
  assert.equal((await request(path+'/register',{confirmed:true,memberId:target.id},token)).status,200);
  const retried=await saved();assert.equal(retried.registeredByMember.id,other.id);assert.equal(retried.confirmedAt,original.confirmedAt);
  const races=await Promise.all([request(path+'/register',{confirmed:true,memberId:concurrent.id},token),request(path+'/register',{confirmed:true,memberId:concurrent.id},otherToken)]);
  for(const response of races)assert.equal(response.status,200,JSON.stringify(response.body));
  const concurrentRows=await participations.findMany({where:{poll:poll.id,member:concurrent.id},populate:{registeredByMember:true}});
  assert.equal(concurrentRows.length,1);assert([user.id,other.id].includes(concurrentRows[0].registeredByMember.id));
  await users.edit(other.id,{blocked:true});
  assert([401,403].includes((await request(search('Durand'),null,otherToken)).status));
  assert([401,403].includes((await request(path+'/register',{confirmed:true,memberId:target.id},otherToken)).status));
  await users.edit(other.id,{blocked:false,role:contributor.id});
  await docs.update({documentId:event.documentId,status:'published',data:{meeting:{...meeting,eventState:'annulé'}}});
  assert.equal((await request(search('Durand'),null,token)).status,400);
  assert.equal((await request(path+'/register',{confirmed:true,memberId:target.id},token)).status,400);
  await docs.unpublish({documentId:event.documentId});
  assert.equal((await request(search('Durand'),null,token)).status,404);
  // Migrate old self-registrations without modifying their confirmation date or modern actor links.
  const oldDate='2026-01-01T10:00:00.000Z';
  const legacy=await participations.create({data:{registrationKey:poll.id+':'+other.id,poll:poll.id,member:other.id,confirmedAt:oldDate}});
  const migrate=require('../src/lib/migrate-participation-registrants');await migrate(app);
  const migrated=await participations.findOne({where:{id:legacy.id},populate:{registeredByMember:true}});
  assert.equal(migrated.registeredByMember.id,other.id);assert.equal(migrated.confirmedAt,oldDate);
  assert.equal((await saved()).registeredByMember.id,other.id);
  await participations.update({where:{id:legacy.id},data:{registeredByMember:null}});await migrate(app);
  assert.equal((await participations.findOne({where:{id:legacy.id},populate:{registeredByMember:true}})).registeredByMember,null);
  console.log('OK : recherche partielle privée, inscriptions par un membre basique, auteur et participant distincts en BDD, reprises sans altérer l’auteur, concurrence et migration des anciennes inscriptions.');
  return {id:target.id,name:'Zoé DURAND'};
}
