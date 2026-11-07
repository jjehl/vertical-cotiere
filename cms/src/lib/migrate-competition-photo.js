const fs=require('node:fs/promises');
const crypto=require('node:crypto');

// Replace the original illustration once; keep later Media Library edits intact.
module.exports=async function migrateCompetitionPhoto(strapi) {
  const store=strapi.store({type:'core',name:'vertical-admin',key:'competition-photo-v2'});
  if(await store.get())return;
  const media=await strapi.store({type:'core',name:'vertical-admin',key:'media-v1'}).get();
  const id=media?.assets['/images/competition.jpg']?.mediaId;
  if(!id)return;
  const file=await strapi.db.query('plugin::upload.file').findOne({where:{id}});
  const originalHash='vc-illustration-'+crypto.createHash('sha256').update('competition.jpg').digest('hex').slice(0,16);
  if(file?.hash===originalHash&&['competition.jpg','Compétition de bloc — dévers.jpg'].includes(file.name)) {
    const filepath='/app/legacy-images/competition-bloc.jpg';
    const {size}=await fs.stat(filepath);
    await strapi.plugin('upload').service('upload').replace(id,{
      data:{fileInfo:{
        name:'Bloc — mouvement sur volumes.jpg',
        alternativeText:'Grimpeur en mouvement sur de grands volumes jaunes et bleus dans une salle de bloc',
        caption:'Nathan Cima / Unsplash — photo d’illustration',
        focalPoint:{x:58,y:48},
      }},
      file:{filepath,originalFilename:'competition-bloc.jpg',mimetype:'image/jpeg',size},
    });
    strapi.log.info('Illustration de compétition : photo de bloc sur volumes remplacée dans la médiathèque.');
  }
  await store.set({value:true});
};
