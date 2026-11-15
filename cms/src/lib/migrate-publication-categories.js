const {normalizeCategory}=require('./publication-categories');

module.exports=async function migratePublicationCategories(strapi) {
  const store=strapi.store({type:'core',name:'vertical-admin',key:'publication-categories-v1'});
  if(await store.get())return;
  const uid='api::publication.publication';
  const rows=await strapi.db.query(uid).findMany({select:['id','category']});
  const {tableName,attributes}=strapi.db.metadata.get(uid);
  // Change each version independently, without publishing or touching updatedAt.
  await strapi.db.connection.transaction(async trx=>{
    for(const row of rows) {
      const category=normalizeCategory(row.category);
      if(category!==row.category)await trx(tableName).where({id:row.id}).update({[attributes.category.columnName]:category});
    }
  });
  await store.set({value:true});
};
