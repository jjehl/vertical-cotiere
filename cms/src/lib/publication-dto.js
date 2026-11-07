const {mediaUrl,mediaDto,imagePosition}=require('./media-urls');
const day=value=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
const followingDay=value=>new Date(new Date(value+'T12:00:00Z').getTime()+86400000).toISOString().slice(0,10);
const parisMidnight=value=>{
  const utc=new Date(value+'T00:00:00Z');
  const zone=new Intl.DateTimeFormat('en',{timeZone:'Europe/Paris',timeZoneName:'longOffset'}).formatToParts(utc).find(p=>p.type==='timeZoneName').value;
  const [,sign,hours,minutes]=zone.match(/GMT([+-])(\d{2}):(\d{2})/);
  return new Date(utc.getTime()-(sign==='+'?1:-1)*(Number(hours)*60+Number(minutes))*60000).toISOString();
};
const html=row=>row.legacyHtml&&row.body===row.legacyBody?row.legacyHtml:'';
const summary=row=>row.legacySummary&&row.body===row.legacyBody?row.legacySummary:(row.body||'').replace(/\s+/g,' ').trim().slice(0,200);
const cover=row=>row.coverImage||row.photos?.[0];
function meetingDto(row){
  const m=row.meeting;if(!m?.start)return null;
  const endDate=m.allDay?followingDay(day(m.end||m.start)):day(m.end||m.start);
  const end=m.allDay?parisMidnight(endDate):m.end||m.start;
  return {slug:row.slug,title:row.title,category:row.category||'Vie du club',summary:summary(row),body:row.body||'',bodyHtml:html(row),image:mediaUrl(cover(row)),start:m.start,end,allDay:m.allDay,startDate:day(m.start),endDate,location:m.location||'',participationUrl:m.participationUrl,participationLabel:m.participationLabel,deadline:m.deadline,eventState:m.eventState||'prévu',tags:m.tags||[],calendarUid:m.calendarUid||row.documentId+'@vertical-cotiere',updatedAt:row.updatedAt,legacySlug:row.legacyType==='event'?row.legacySlug:undefined};
}
function publicationDto(row,{detail=false,index={photos:{},assets:{}}}={}){
  const picture=cover(row);
  const result={slug:row.slug,title:row.title,date:row.date,category:row.category||'Vie du club',summary:summary(row),image:mediaUrl(picture),imageAlt:picture?.alternativeText||'',imagePosition:imagePosition(picture),photoCount:row.photos?.length||0,meeting:meetingDto(row)};
  if(detail){
    const legacy=new Map(Object.entries(index.photos||{}).map(([old,id])=>[Number(id),Number(old)]));
    const aliases=new Map(Object.values(index.assets||{}).filter(a=>a.documentSlug).map(a=>[a.mediaId,'/document-files/'+a.documentSlug]));
    result.body=row.body||'';result.bodyHtml=html(row);
    result.photos=(row.photos||[]).map(f=>({id:f.id,legacyId:legacy.get(f.id),title:f.caption||f.alternativeText||f.name,src:mediaUrl(f),thumb:mediaUrl(f)+'?variant=thumbnail',width:f.width,height:f.height}));
    result.attachments=(row.attachments||[]).filter(f=>!result.bodyHtml.includes('/media/'+f.id)&&(!aliases.has(f.id)||!result.bodyHtml.includes(aliases.get(f.id)))).map(mediaDto);
  }
  return result;
}
module.exports={publicationDto,meetingDto};
