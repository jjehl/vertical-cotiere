const service=require('../../../lib/content-sync-service');
const site=require('../../../lib/content-sync-site-service');
const types=require('../../../lib/content-sync-site-model').types;
const handle=action=>async ctx=>{
  try{return await action(ctx);}catch(error){
    if(error.status&&error.status<500)ctx.throw(error.status,error.message);
    strapi.log.error('Échec de synchronisation des contenus',error);
    ctx.throw(500,'Synchronisation impossible ; consulter les journaux du CMS.');
  }
};
const input=ctx=>{
  const body=ctx.request.body;
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!['publication','content','adoptSlug'].includes(key))||Boolean(body.content)===Boolean(body.publication)||('adoptSlug'in body&&typeof body.adoptSlug!=='boolean'))ctx.throw(400,'Paramètres d’import invalides.');
  if(body.content&&body.content.version!==2)ctx.throw(400,'Format de contenu incompatible.');
  return body;
};
module.exports={
  export:handle(async ctx=>{
    const page=Number(ctx.query.page||1),pageSize=Number(ctx.query.pageSize||10),slug=ctx.query.slug;
    const type=ctx.query.type||'publications';
    if(type!=='publications'&&!types.includes(type))ctx.throw(400,'Type de contenu non synchronisable.');
    if(!Number.isSafeInteger(page)||page<1||!Number.isSafeInteger(pageSize)||pageSize<1||pageSize>25||(slug!==undefined&&(typeof slug!=='string'||!(/^[a-zA-Z0-9_-]{1,200}$/).test(slug))))ctx.throw(400,'Pagination ou slug invalide.');
    ctx.set('Cache-Control','private, no-store');ctx.body=await (type==='publications'?service:site).exportPage(strapi,{type,page,pageSize,slug});
  }),
  download:handle(async ctx=>{
    const id=Number(ctx.params.id);if(!Number.isSafeInteger(id)||id<1)ctx.throw(400,'Fichier invalide.');
    const {file,stream}=await service.download(strapi,id);
    ctx.set('Cache-Control','private, no-store');ctx.set('X-Content-Type-Options','nosniff');ctx.type=file.mime;ctx.body=stream;
  }),
  plan:handle(async ctx=>{const {publication,content,adoptSlug}=input(ctx);ctx.set('Cache-Control','private, no-store');ctx.body=content?site.publicPlan(await site.plan(strapi,content,{adoptSlug})):service.publicPlan(await service.plan(strapi,publication,{adoptSlug}));}),
  import:handle(async ctx=>{const {publication,content,adoptSlug}=input(ctx);ctx.set('Cache-Control','private, no-store');ctx.body=content?await site.importContent(strapi,content,{adoptSlug}):await service.importPublication(strapi,publication,{adoptSlug});}),
  upload:handle(async ctx=>{
    let metadata;try{metadata=JSON.parse(ctx.request.body?.metadata);}catch{ctx.throw(400,'Métadonnées JSON requises.');}
    const files=ctx.request.files?.files;const file=Array.isArray(files)&&files.length===1?files[0]:files;
    ctx.body=await service.upload(strapi,file,metadata);
  }),
};
