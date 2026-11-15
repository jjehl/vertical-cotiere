// Add the sortable event date once, preserving other list and form preferences.
module.exports=async function configurePublicationList(strapi) {
  const store=strapi.store({type:'core',name:'vertical-admin',key:'publication-list-event-date-v1'});
  if(await store.get())return;
  const model=strapi.contentTypes['api::publication.publication'];
  const service=strapi.plugin('content-manager').service('content-types');
  const config=await service.findConfiguration(model);
  config.metadatas.date.list.label='Date de publication';
  config.metadatas.eventDate.edit={...config.metadatas.eventDate.edit,visible:false,editable:false};
  config.metadatas.eventDate.list={...config.metadatas.eventDate.list,label:'Date de l’événement',sortable:true};
  config.layouts.edit=config.layouts.edit.map(row=>row.filter(field=>field.name!=='eventDate')).filter(row=>row.length);
  if(!config.layouts.list.includes('eventDate')) {
    const after=config.layouts.list.indexOf('date');
    config.layouts.list.splice(after<0?config.layouts.list.length:after+1,0,'eventDate');
  }
  await service.updateConfiguration(model,config);
  await store.set({value:true});
};
