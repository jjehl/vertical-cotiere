// The schedule now lists stages directly. Keep the old resource as a draft,
// without continuing to expose a duplicate, outdated public page.
module.exports=async function retireStagesPage(strapi) {
  const store=strapi.store({type:'core',name:'vertical-admin',key:'retire-stages-page-v1'});
  if(await store.get())return;
  const uid='api::page.page';
  const rows=await strapi.db.query(uid).findMany({where:{slug:'stages'}});
  await strapi.db.transaction(async()=>{
    for(const documentId of new Set(rows.filter(row=>row.publishedAt).map(row=>row.documentId))) {
      await strapi.documents(uid).unpublish({documentId});
    }
    await store.set({value:true});
  });
};
