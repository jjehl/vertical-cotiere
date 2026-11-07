// Upgrade instances migrated before attachments were added to all content types.
module.exports=async function linkInlineMedia(strapi) {
  const media=await strapi.store({type:'core',name:'vertical-admin',key:'media-v1'}).get();
  if(!media)return;
  const store=strapi.store({type:'core',name:'vertical-admin',key:'inline-media-v1'});
  if(await store.get())return;
  for(const uid of ['api::page.page','api::article.article','api::event.event','api::activity.activity']) {
    for(const row of await strapi.db.query(uid).findMany({populate:{attachments:true}})) {
      const ids=new Set((row.attachments||[]).map(f=>f.id));
      for(const match of (row.bodyHtml||'').matchAll(/\/media\/(\d+)/g))ids.add(Number(match[1]));
      if(ids.size)await strapi.db.query(uid).update({where:{id:row.id},data:{attachments:[...ids]}});
    }
  }
  await store.set({value:true});
};
