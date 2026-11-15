module.exports=async function configurePublicationCategory(strapi) {
  const store=strapi.store({type:'core',name:'vertical-admin',key:'publication-category-label-v1'});
  if(await store.get())return;
  const model=strapi.contentTypes['api::publication.publication'];
  const service=strapi.plugin('content-manager').service('content-types');
  const config=await service.findConfiguration(model);
  config.metadatas.category.edit={...config.metadatas.category.edit,label:'Catégorie',description:'Cours, Compétition, Sortie, Stage ou Vie du club.'};
  config.metadatas.category.list={...config.metadatas.category.list,label:'Catégorie'};
  await service.updateConfiguration(model,config);
  await store.set({value:true});
};
