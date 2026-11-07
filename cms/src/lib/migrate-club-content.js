const fs=require('node:fs/promises');
const crypto=require('node:crypto');
const path=require('node:path');

// Initial links only: subsequent editorial choices stay in Strapi.
module.exports=async function migrateClubContent(strapi) {
  const store=strapi.store({type:'core',name:'vertical-admin',key:'club-documents-photo-v1'});
  if(await store.get())return;
  const media=await strapi.store({type:'core',name:'vertical-admin',key:'media-v1'}).get();
  if(!media)return;
  const pages=await strapi.db.query('api::page.page').findMany({where:{slug:'presentation'},populate:{documents:true}});
  if(!pages.length)return;
  const specifications=[
    {originalTitle:'Vertical Cotiere Reglement interieur modifie le 08 .09.2026',legacyPath:'/imports/db1fcada21af-Vertical-Cotiere-Reglement-interieur-modifie-le-08-.09.2026.pdf',title:'Règlement intérieur',description:'Version modifiée le 8 septembre 2026.'},
    {originalTitle:'PV AG 2025',legacyPath:'/imports/de3aaed04b27-PV-AG-2025.pdf',title:'Procès-verbal de l’AG 2025',description:'Compte rendu de l’assemblée générale de 2025.'},
  ];
  const selected=[];
  for(const spec of specifications) {
    const rows=await strapi.db.query('api::club-document.club-document').findMany({where:{legacyPath:spec.legacyPath},populate:{file:true}});
    if(!rows.length){strapi.log.warn('Document non repris (absent de la bibliothèque) : '+spec.legacyPath);continue;}
    for(const row of rows) {
      // Friendly labels for untouched imported records, preserving any editorial edits.
      if(row.title===spec.originalTitle&&!row.description)await strapi.db.query('api::club-document.club-document').update({where:{id:row.id},data:{title:spec.title,description:spec.description}});
    }
    selected.push(rows);
  }
  for(const page of pages) {
    const ids=selected.map(rows=>rows.find(row=>Boolean(row.publishedAt)===Boolean(page.publishedAt))).filter(Boolean).map(row=>row.id);
    await strapi.db.query('api::page.page').update({where:{id:page.id},data:{documents:[...new Set([...(page.documents||[]).map(d=>d.id),...ids])]}});
  }
  const mediaId=media.assets['/images/cours.jpg']?.mediaId;
  const file=mediaId?await strapi.db.query('plugin::upload.file').findOne({where:{id:mediaId}}):null;
  const originalHash='vc-illustration-'+crypto.createHash('sha256').update('cours.jpg').digest('hex').slice(0,16);
  if(file?.hash===originalHash&&file.name==='cours.jpg') {
    const filepath=path.resolve('/app/legacy-images/cours-femme.jpg');
    const {size}=await fs.stat(filepath);
    await strapi.plugin('upload').service('upload').replace(file.id,{
      data:{fileInfo:{name:'Cours d’escalade — grimpeuse en salle.jpg',alternativeText:'Grimpeuse adulte équipée d’un baudrier lors d’une séance d’escalade en salle',caption:'Pavel Danilyuk / Pexels — photo d’illustration',focalPoint:{x:100,y:45}}},
      file:{filepath,originalFilename:'cours-femme.jpg',mimetype:'image/jpeg',size},
    });
  }
  await store.set({value:true});
  strapi.log.info('Page du club : documents reliés et illustration des cours vérifiée.');
};
