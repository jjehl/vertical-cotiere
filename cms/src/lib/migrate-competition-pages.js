const content=require('../../content/competition-pages.json');

// Apply the requested editorial consolidation once. Later edits remain in Strapi.
module.exports=async function migrateCompetitionPages(strapi) {
  const store=strapi.store({type:'core',name:'vertical-admin',key:'competition-pages-evergreen-v1'});
  if(await store.get())return;
  const uid='api::page.page';
  const pages=await strapi.db.query(uid).findMany({where:{slug:{$in:content.pages.map(page=>page.slug)}}});
  if(!content.pages.every(page=>pages.some(row=>row.slug===page.slug)))return;
  const aliases=await strapi.db.query(uid).findMany({where:{slug:{$in:content.aliases}}});
  await strapi.db.transaction(async()=>{
    for(const page of content.pages)for(const row of pages.filter(row=>row.slug===page.slug)) {
      // Update each version without publishing unrelated unpublished changes.
      await strapi.db.query(uid).update({where:{id:row.id},data:{title:page.title,bodyHtml:page.bodyHtml,group:page.group,structuredData:null,attachments:[],documents:[]}});
    }
    // Old pages remain as drafts in Strapi; their public URLs redirect to the article.
    for(const documentId of new Set(aliases.filter(row=>row.publishedAt).map(row=>row.documentId))) {
      await strapi.documents(uid).unpublish({documentId});
    }
    await store.set({value:true});
  });
};
