const uid='api::publication.publication';
const sources=[['article','api::article.article'],['event','api::event.event'],['album','api::album.album']];
const ids=files=>(files||[]).map(f=>f.id);
const plain=html=>String(html||'').replace(/<[^>]+>/g,' ').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const archiveDate=title=>{
  const day=title?.match(/^(\d{4}-\d{2}-\d{2})(?:\D|$)/)?.[1];
  return day&&Number.isFinite(Date.parse(day+'T12:00:00Z'))&&new Date(day+'T12:00:00Z').toISOString().slice(0,10)===day?day+'T12:00:00Z':null;
};
module.exports=async function migratePublications(strapi){
  const store=strapi.store({type:'core',name:'vertical-admin',key:'publications-v1'});
  if(await store.get())return;
  let count=0;
  for(const [kind,source]of sources){
    const populate=kind==='album'?{images:true,coverImage:true}:{attachments:true,coverImage:true};
    const rows=await strapi.db.query(source).findMany({populate});
    const groups=new Map();
    for(const row of rows){if(!groups.has(row.documentId))groups.set(row.documentId,[]);groups.get(row.documentId).push(row);}
    for(const [sourceId,versions]of groups){
      const key=kind+':'+sourceId;
      if(await strapi.documents(uid).findFirst({filters:{legacyKey:key}}))continue;
      const published=versions.find(r=>r.publishedAt);
      const draft=versions.find(r=>!r.publishedAt)||published;
      const original=published||draft;
      let slug=original.slug;
      if(await strapi.documents(uid).findFirst({filters:{slug}}))slug=kind+'-'+slug;
      const convert=row=>{
        const body=kind==='album'?row.description||'':row.body||plain(row.bodyHtml);
        const data={title:row.title,slug,body,legacyKey:key,legacyType:kind,legacySlug:original.slug,legacyBody:body,legacyHtml:row.bodyHtml||'',legacySummary:row.summary||'',date:kind==='article'?row.date+'T12:00:00Z':kind==='event'?row.start:archiveDate(row.title),category:row.category||'Vie du club',coverImage:row.coverImage?.id||null,photos:kind==='album'?ids(row.images):ids(row.attachments?.filter(f=>f.mime?.startsWith('image/'))),attachments:kind==='album'?[]:ids(row.attachments?.filter(f=>!f.mime?.startsWith('image/'))),meeting:null};
        if(kind==='event'){
          data.meeting=Object.fromEntries(['start','end','allDay','location','participationUrl','participationLabel','deadline','eventState','calendarUid','tags'].map(k=>[k,row[k]]));
          if(new Date(row.end)<new Date(row.start)){
            data.meeting.end=null;
            strapi.log.warn(`Fin antérieure au début pour ${row.slug} : fin laissée non précisée, original conservé dans les archives.`);
          }
        }
        return data;
      };
      // Copy the published snapshot first, then retain any unpublished edits separately.
      await strapi.db.transaction(async()=>{
        const created=await strapi.documents(uid).create({data:convert(original)});
        if(published)await strapi.documents(uid).publish({documentId:created.documentId});
        if(draft&&draft!==original)await strapi.documents(uid).update({documentId:created.documentId,data:convert(draft)});
      });
      count++;
    }
  }
  await store.set({value:{completed:true}});
  strapi.log.info(`${count} publications reprises depuis les actualités, rendez-vous et albums (brouillons conservés).`);
};
