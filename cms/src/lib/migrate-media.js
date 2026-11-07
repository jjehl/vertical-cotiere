const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('sharp');
const mime = require('mime-types');

const read = name => JSON.parse(require('node:fs').readFileSync(path.join(__dirname,'../../content',name),'utf8'));
const key = value => crypto.createHash('sha256').update(value).digest('hex').slice(0,16);

module.exports = async function migrateMedia(strapi) {
  if (process.env.IMPORT_MEDIA !== 'true') return;
  const store = strapi.store({type:'core',name:'vertical-admin',key:'media-v1'});
  if (await store.get()) return;
  const uploadRoot = path.join(strapi.dirs.static.public,'uploads');
  await fs.mkdir(uploadRoot,{recursive:true});
  const folderService = strapi.plugin('upload').service('folder');
  const folders = new Map();
  async function folder(name,parent) {
    const cacheKey=`${parent?.id||0}:${name}`;
    if(folders.has(cacheKey)) return folders.get(cacheKey);
    let result=await strapi.db.query('plugin::upload.folder').findOne({where:{name,parent:parent?.id||null}});
    if(!result)result=await folderService.create({name,...(parent?{parent:parent.id}:{})});
    folders.set(cacheKey,result);return result;
  }
  async function register(source,hash,name,targetFolder,thumbnail) {
    let file=await strapi.db.query('plugin::upload.file').findOne({where:{hash}});
    if(file) return file;
    const ext=path.extname(source).toLowerCase();
    const stat=await fs.stat(source); // Missing source aborts the migration, never silently drops a photo.
    const filename=hash+ext;
    await fs.copyFile(source,path.join(uploadRoot,filename));
    const data={name,hash,ext,mime:mime.lookup(ext)||'application/octet-stream',size:stat.size/1000,url:'/uploads/'+filename,provider:'local',folder:targetFolder.id,folderPath:targetFolder.path};
    if(data.mime.startsWith('image/')) {
      const info=await sharp(source,{animated:false}).metadata();
      data.width=info.width;data.height=info.height;
      const thumbHash='thumbnail_'+hash;
      let thumbExt,thumbPath;
      if(thumbnail) {
        thumbExt=path.extname(thumbnail).toLowerCase();thumbPath=path.join(uploadRoot,thumbHash+thumbExt);
        await fs.copyFile(thumbnail,thumbPath);
      } else {
        thumbExt='.png';thumbPath=path.join(uploadRoot,thumbHash+thumbExt);
        await sharp(source,{animated:false}).resize({width:256,height:256,fit:'inside',withoutEnlargement:true}).png().toFile(thumbPath);
      }
      const thumb=await sharp(thumbPath).metadata();
      const thumbStat=await fs.stat(thumbPath);
      data.formats={thumbnail:{name:'thumbnail_'+name,hash:thumbHash,ext:thumbExt,mime:mime.lookup(thumbExt),width:thumb.width,height:thumb.height,size:thumbStat.size/1000,url:'/uploads/'+thumbHash+thumbExt}};
      data.caption=name.replace(/\.[^.]+$/,'');
    }
    return strapi.db.query('plugin::upload.file').create({data});
  }

  const index={photos:{},assets:{}};
  const albums=read('gallery.json');
  const albumsFolder=await folder('Albums du club');
  let imported=0;
  for(const album of albums) {
    const destination=await folder(album.title,albumsFolder);
    const ids=[];
    for(const photo of album.photos) {
      const file=await register(path.join('/app/legacy-gallery',path.basename(photo.src)),`vc-gallery-${photo.id}`,photo.title.endsWith('.jpg')?photo.title:photo.title+'.jpg',destination,path.join('/app/legacy-gallery',path.basename(photo.thumb)));
      index.photos[photo.id]=file.id;ids.push(file.id);
      if(++imported%100===0)strapi.log.info(`Médiathèque : ${imported} photos reprises`);
    }
    const rows=await strapi.db.query('api::album.album').findMany({where:{sourceId:album.sourceId}});
    for(const row of rows) {
      // Migrate each stored version directly so unpublished edits stay unpublished.
      await strapi.db.query('api::album.album').update({where:{id:row.id},data:{images:ids,coverImage:ids[0]||null}});
    }
  }

  const report=read('import-report.json');
  const assetsFolder=await folder('Documents et images du site');
  for(const [legacyPath,localUrl] of Object.entries(report.assetRedirects)) {
    const filename=path.basename(localUrl);
    const file=await register(path.join('/app/legacy-imports',filename),'vc-import-'+key(localUrl),path.basename(legacyPath),assetsFolder);
    const entry={mediaId:file.id};
    if(/\.(pdf|docx?|xlsx?|odt|ods|zip)$/i.test(filename)) {
      const slug='document-'+key(localUrl);
      let document=await strapi.documents('api::club-document.club-document').findFirst({filters:{slug}});
      if(!document)document=await strapi.documents('api::club-document.club-document').create({status:'published',data:{slug,title:path.basename(legacyPath).replace(/\.[^.]+$/,'').replace(/[-_]+/g,' '),category:/secur|noeud|regles/i.test(legacyPath)?'Sécurité':/coupe|compet|resultat/i.test(legacyPath)?'Compétitions':/reglement|pv-ag|pedagog/i.test(legacyPath)?'Vie du club':'Archives',file:file.id,legacyPath:localUrl}});
      entry.documentSlug=slug;
    }
    index.assets[localUrl]=entry;
  }
  const illustrations=await folder('Illustrations du site');
  for(const name of ['hero.jpg','nature.jpg','competition.jpg','cours.jpg']) {
    const file=await register(path.join('/app/legacy-images',name),'vc-illustration-'+key(name),name,illustrations);
    index.assets['/images/'+name]={mediaId:file.id};
  }
  const alias = entry => entry.documentSlug?'/document-files/'+entry.documentSlug:'/media/'+entry.mediaId;
  for(const uid of ['api::page.page','api::article.article','api::event.event','api::activity.activity']) {
    const rows=await strapi.db.query(uid).findMany({});
    for(const row of rows) {
      const data={};
      const linked=[];
      if(row.bodyHtml) {
        let html=row.bodyHtml;
        for(const [old,entry] of Object.entries(index.assets)) {
          if(html.includes(old)) { linked.push(entry.mediaId); html=html.split(old).join(alias(entry)); }
        }
        data.bodyHtml=html;
      }
      data.attachments=[...new Set(linked)];
      if(uid!=='api::page.page'&&row.image&&index.assets[row.image]) data.coverImage=index.assets[row.image].mediaId;
      if(Object.keys(data).length)await strapi.db.query(uid).update({where:{id:row.id},data});
    }
  }
  const timetable=await strapi.db.query('api::club-timetable.club-timetable').findMany({});
  const source=read('initial.json').pages.find(p=>p.slug==='horaires');
  const attachments=Object.entries(index.assets).filter(([url])=>source.bodyHtml.includes(url)).map(([,entry])=>entry.mediaId);
  for(const row of timetable)await strapi.db.query('api::club-timetable.club-timetable').update({where:{id:row.id},data:{attachments}});
  await store.set({value:index});
  strapi.log.info(`Médiathèque : ${Object.keys(index.photos).length} photos et ${Object.keys(index.assets).length} fichiers/illustrations repris.`);
};
