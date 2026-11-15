// Backfill each draft/published version separately without publishing drafts or
// changing editorial timestamps. Future edits are handled by publication-editor.
module.exports=async function migratePublicationEventDate(strapi) {
  const uid='api::publication.publication';
  const store=strapi.store({type:'core',name:'vertical-admin',key:'publication-event-date-v1'});
  if(await store.get())return;
  const rows=await strapi.db.query(uid).findMany({populate:{meeting:true}});
  const {tableName,attributes}=strapi.db.metadata.get(uid);
  await strapi.db.connection.transaction(async trx=>{
    for(const row of rows) {
      await trx(tableName).where({id:row.id}).update({[attributes.eventDate.columnName]:row.meeting?.start||null});
    }
  });
  await store.set({value:true});
};
