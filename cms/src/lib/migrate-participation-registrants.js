// Before registering someone else was possible, every registration was a self-registration.
module.exports=async function migrateParticipationRegistrants(strapi) {
  const marker=strapi.store({type:'core',name:'vertical-members',key:'participation-registrants-v1'});
  if(await marker.get())return;
  const query=strapi.db.query('api::event-participation.event-participation');
  const rows=await query.findMany({where:{registeredByMember:{id:{$null:true}}},select:['id'],populate:{member:{select:['id']}}});
  for(const row of rows)if(row.member)await query.update({where:{id:row.id},data:{registeredByMember:row.member.id}});
  // Run once: a later deletion of an actor must not turn a delegated registration into a self-registration.
  await marker.set({value:true});
};
