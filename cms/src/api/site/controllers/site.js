const {publicationDto,meetingDto}=require('../../../lib/publication-dto');
const publicationUid='api::publication.publication';
const publicationPopulate={photos:true,attachments:true,coverImage:true,meeting:true};
const {getMediaIndex,mediaUrl,mediaDto,documentDto,imagePosition}=require('../../../lib/media-urls');
const weekdays=['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const publicRows=(uid,fields,sort,populate)=>strapi.documents(uid).findMany({status:'published',fields,sort,populate,limit:500});
const strip=({id,documentId,...item})=>item;
const withAttachments=({attachments,documents,...item},aliases)=>({...strip(item),...(documents?{documents:documents.filter(d=>d.publishedAt&&d.file).map(documentDto)}:{}),attachments:(attachments||[]).filter(file=>!aliases?.has(file.id)||!item.bodyHtml?.includes(aliases.get(file.id))).map(mediaDto)});
const withCover=({coverImage,...item},aliases)=>({...withAttachments(item,aliases),image:mediaUrl(coverImage),imageAlt:coverImage?.alternativeText||'',imagePosition:imagePosition(coverImage)});
const time=value=>value?.slice(0,5)||'';
const publishedFile=async id=>{
  const file=await strapi.db.query('plugin::upload.file').findOne({where:{id},populate:{related:true}});
  return file?.related?.some(row=>row.publishedAt&&!['api::article.article','api::event.event','api::album.album'].includes(row.__type))?file:null;
};
module.exports={
  async albums(ctx){
    const rows=await strapi.documents(publicationUid).findMany({status:'published',filters:{legacyType:'album'},populate:publicationPopulate,limit:1000});
    ctx.body=rows.map(row=>({slug:row.legacySlug,title:row.title,description:row.body,cover:mediaUrl(row.coverImage||row.photos?.[0]),count:row.photos?.length||0}));
  },
  async album(ctx){
    const row=await strapi.documents(publicationUid).findFirst({status:'published',filters:{legacyType:'album',legacySlug:ctx.params.slug},populate:publicationPopulate});
    if(!row)return ctx.notFound('Publication introuvable');
    const detail=publicationDto(row,{detail:true,index:await getMediaIndex(strapi)});
    ctx.body={slug:row.slug,title:row.title,description:row.body,photos:detail.photos};
  },
  async publication(ctx){
    const row=await strapi.documents(publicationUid).findFirst({status:'published',filters:{slug:ctx.params.slug},populate:publicationPopulate});
    if(!row)return ctx.notFound('Publication introuvable');
    ctx.body=publicationDto(row,{detail:true,index:await getMediaIndex(strapi)});
  },
  async publicationAlias(ctx){
    const match=String(ctx.query.path||'').match(/^\/(actualites|agenda|albums)\/([^/]+)\/?$/);
    if(!match)return ctx.notFound();
    const kind={actualites:'article',agenda:'event',albums:'album'}[match[1]];
    const row=await strapi.documents(publicationUid).findFirst({status:'published',filters:{legacyType:kind,legacySlug:match[2]},fields:['slug']});
    if(!row)return ctx.notFound();
    ctx.body={url:'/vie-du-club/'+row.slug};
  },
  async content(ctx){
    const [activities,publicationRows,pages,timetable]=await Promise.all([
      publicRows('api::activity.activity',['slug','title','eyebrow','summary','body','audience','tag','order'],'order:asc',{coverImage:true,attachments:true}),
      strapi.documents(publicationUid).findMany({status:'published',populate:publicationPopulate,limit:1000}),
      publicRows('api::page.page',['slug','title','bodyHtml','group'],'title:asc',{attachments:true,documents:{populate:{file:true}}}),
      strapi.documents('api::club-timetable.club-timetable').findFirst({status:'published',populate:{sessions:true,ufraps:{populate:{closures:true,closedDays:true}},attachments:true}}),
    ]);
    let plan=null;
    if(timetable?.ufraps){
      const u=timetable.ufraps;
      plan={season:timetable.season,note:timetable.note,sessions:timetable.sessions.map(s=>({label:s.label,day:weekdays.indexOf(s.day)+1,start:time(s.start),end:time(s.end),audience:s.audience,birthYears:s.birthYears,capacity:s.capacity,supervised:s.supervised})),ufraps:{opens:u.opens,closes:u.closes,day:weekdays.indexOf(u.day)+1,start:time(u.start),end:time(u.end),closures:(u.closures||[]).map(c=>({label:c.label,from:c.from,until:c.until})),closedDays:(u.closedDays||[]).map(d=>({date:d.date,label:d.label})),holidays:(u.closedDays||[]).map(d=>d.date)},attachments:(timetable.attachments||[]).map(mediaDto)};
    }
    const index=await getMediaIndex(strapi);
    const aliases=new Map(Object.values(index.assets).filter(a=>a.documentSlug).map(a=>[a.mediaId,'/document-files/'+a.documentSlug]));
    const publications=publicationRows.map(row=>publicationDto(row)).sort((a,b)=>(b.date||'').localeCompare(a.date||'')||a.title.localeCompare(b.title,'fr'));
    const events=publicationRows.map(meetingDto).filter(Boolean).sort((a,b)=>a.start.localeCompare(b.start));
    ctx.body={activities:activities.map(row=>withCover(row,aliases)),publications,events,pages:pages.map(row=>withAttachments(row,aliases)),timetable:plan};
  },
  async documents(ctx){
    const rows=await publicRows('api::club-document.club-document',['title','slug','category','description'],'title:asc',{file:true});
    ctx.body=rows.filter(d=>d.file).map(documentDto);
  },
  async documentFile(ctx){
    const row=await strapi.documents('api::club-document.club-document').findFirst({status:'published',filters:{slug:ctx.params.slug},populate:{file:true}});
    if(!row?.file)return ctx.notFound('Document introuvable');
    ctx.body=mediaDto(row.file);
  },
  async file(ctx){
    const id=Number(ctx.params.id);
    if(!Number.isSafeInteger(id)||id<1)return ctx.notFound();
    const file=await publishedFile(id);
    if(!file)return ctx.notFound('Fichier introuvable');
    const thumb=ctx.query.variant==='thumbnail'?file.formats?.small||file.formats?.thumbnail:undefined;
    ctx.body={...mediaDto(file),storageUrl:thumb?.url||file.url};
  },
  async galleryFile(ctx){
    const index=await getMediaIndex(strapi);
    const id=index.photos[ctx.params.id];
    if(!id||!(await publishedFile(id)))return ctx.notFound();
    ctx.body={url:'/media/'+id+(ctx.query.variant==='thumb'?'?variant=thumbnail':'')};
  },
  async legacyAsset(ctx){
    const index=await getMediaIndex(strapi);
    const entry=index.assets['/imports/'+ctx.params.file];
    if(!entry)return ctx.notFound();
    if(entry.documentSlug){
      const doc=await strapi.documents('api::club-document.club-document').findFirst({status:'published',filters:{slug:entry.documentSlug},populate:{file:true}});
      if(!doc?.file)return ctx.notFound();
      ctx.body={url:'/document-files/'+entry.documentSlug};
    }else{
      if(!(await publishedFile(entry.mediaId)))return ctx.notFound();
      ctx.body={url:'/media/'+entry.mediaId};
    }
  },
};
