const {meetingDto}=require('./publication-dto');
const pollUid='api::participation-poll.participation-poll';
const participationUid='api::event-participation.event-participation';
const memberUid='plugin::users-permissions.user';
const activeMember={blocked:false,confirmed:true,role:{type:{$in:['authenticated','contributor']}}};
const memberName=user=>[user.firstName,user.lastName].filter(Boolean).join(' ').trim()||'Un membre';

// Keep registrations separate from editorial drafts and published versions.
async function publishedMeeting(strapi,ctx) {
  ctx.set('Cache-Control','private, no-store');
  const row=await strapi.documents('api::publication.publication').findFirst({
    status:'published',filters:{slug:ctx.params.slug},populate:{meeting:true},
  });
  if(!row?.meeting?.start)ctx.throw(404,'Rendez-vous introuvable.');
  return row;
}
function registrationsOpen(row,now=new Date()) {
  const meeting=meetingDto(row);
  return !!meeting&&meeting.eventState==='prévu'&&
    new Date(meeting.end)>now&&(!meeting.deadline||new Date(meeting.deadline)>now);
}
async function findPoll(strapi,publicationDocumentId) {
  return strapi.db.query(pollUid).findOne({where:{publicationDocumentId}});
}
// A database uniqueness constraint also protects against simultaneous requests.
async function createOnce(strapi,query,where,data) {
  if(await query.findOne({where}))return;
  // Commit the row and its relations together so a concurrent retry cannot
  // observe a registration before its member relation has been attached.
  try{await strapi.db.transaction(async()=>{await query.create({data});});}
  catch(error){if(!await query.findOne({where}))throw error;}
}
async function pollDto(strapi,row,user) {
  const poll=await findPoll(strapi,row.documentId);
  const rows=poll?await strapi.db.query(participationUid).findMany({
    where:{poll:poll.id},select:['id'],
    populate:{member:{select:['id','firstName','lastName']}},
    orderBy:[{confirmedAt:'asc'},{id:'asc'}],
  }):[];
  const participants=rows.filter(item=>item.member).map(({member})=>({
    name:memberName(member),
    isCurrentMember:member.id===user.id,
  }));
  return {exists:!!poll,open:registrationsOpen(row),registered:participants.some(item=>item.isCurrentMember),participants};
}
async function read(strapi,ctx,user) {
  const row=await publishedMeeting(strapi,ctx);
  ctx.body=await pollDto(strapi,row,user);
}
async function create(strapi,ctx,user) {
  const row=await publishedMeeting(strapi,ctx);
  if(!registrationsOpen(row))ctx.throw(400,'Les inscriptions à ce rendez-vous sont closes.');
  await createOnce(strapi,strapi.db.query(pollUid),{publicationDocumentId:row.documentId},{publicationDocumentId:row.documentId,createdByMember:user.id});
  ctx.body=await pollDto(strapi,row,user);
}
async function register(strapi,ctx,user) {
  const body=ctx.request.body;
  if(!body||body.confirmed!==true||Object.keys(body).some(key=>!['confirmed','memberId'].includes(key)))ctx.throw(400,'Veuillez confirmer l’inscription à cet événement.');
  if(body.memberId!==undefined&&(!Number.isSafeInteger(body.memberId)||body.memberId<1))ctx.throw(400,'Sélectionnez un membre valide.');
  const row=await publishedMeeting(strapi,ctx);
  const poll=await findPoll(strapi,row.documentId);
  if(!poll)ctx.throw(404,'Sondage introuvable.');
  if(!registrationsOpen(row))ctx.throw(400,'Les inscriptions à ce rendez-vous sont closes.');
  const participant=body.memberId===undefined||body.memberId===user.id?user:await strapi.db.query(memberUid).findOne({where:{id:body.memberId,...activeMember},select:['id']});
  if(!participant)ctx.throw(404,'Membre introuvable.');
  const registrationKey=poll.id+':'+participant.id;
  // The authenticated actor is immutable on retries, even when someone else
  // submits the same participant later. Never accept the actor from the client.
  await createOnce(strapi,strapi.db.query(participationUid),{registrationKey},{registrationKey,poll:poll.id,member:participant.id,registeredByMember:user.id,confirmedAt:new Date().toISOString()});
  ctx.body=await pollDto(strapi,row,user);
}
async function searchMembers(strapi,ctx) {
  const row=await publishedMeeting(strapi,ctx);
  const poll=await findPoll(strapi,row.documentId);
  if(!poll)ctx.throw(404,'Sondage introuvable.');
  if(!registrationsOpen(row))ctx.throw(400,'Les inscriptions à ce rendez-vous sont closes.');
  const query=ctx.query.q;
  if(typeof query!=='string'||!query.trim()||query.trim().length>80||!(/\p{L}/u).test(query))ctx.throw(400,'Saisissez un nom, un prénom ou quelques lettres (80 caractères maximum).');
  const tokens=query.trim().split(/\s+/);
  const members=await strapi.db.query(memberUid).findMany({
    where:{...activeMember,$and:tokens.map(value=>({$or:[{firstName:{$containsi:value}},{lastName:{$containsi:value}}]}))},
    select:['id','firstName','lastName'],orderBy:[{lastName:'asc'},{firstName:'asc'},{id:'asc'}],limit:21,
  });
  const results=members.slice(0,20);
  const registrations=results.length?await strapi.db.query(participationUid).findMany({
    where:{poll:poll.id,member:{id:{$in:results.map(member=>member.id)}}},select:['id'],populate:{member:{select:['id']}},
  }):[];
  const registered=new Set(registrations.map(item=>item.member?.id));
  ctx.body={members:results.map(member=>({id:member.id,name:memberName(member),registered:registered.has(member.id)})),hasMore:members.length>20};
}
module.exports={read,create,register,searchMembers,findPoll,registrationsOpen};
