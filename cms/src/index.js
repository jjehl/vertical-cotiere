const path = require('node:path');
const fs = require('node:fs');

module.exports = {
  register({strapi}) {
    strapi.documents.use((context,next)=>require('./lib/publication-editor')(context,next,strapi));
    strapi.documents.use(async(context,next)=>{
      if(context.uid==='api::club-timetable.club-timetable'&&['create','update','publish'].includes(context.action)) {
        const {validateTimetable,mergeTimetable}=require('./lib/schedule-validation');
        const previous=context.params.documentId?await strapi.documents(context.uid).findOne({documentId:context.params.documentId,populate:{sessions:true,ufraps:{populate:{closures:true}}}}):{};
        validateTimetable(mergeTimetable(previous||{},context.params.data||{}));
      }
      return next();
    });
  },
  async bootstrap({ strapi }) {
    await require('./lib/migrate-publication-categories')(strapi);
    await require('./lib/configure-admin')(strapi);
    await require('./lib/configure-registrations')(strapi);
    await require('./lib/configure-members')(strapi);
    await require('./lib/migrate-participation-registrants')(strapi);
    if (process.env.SEED_CONTENT !== 'true') {
      await require('./lib/migrate-timetable')(strapi);
      await require('./lib/migrate-media')(strapi);
      await require('./lib/link-inline-media')(strapi);
      await require('./lib/migrate-club-content')(strapi);
      await require('./lib/migrate-competition-photo')(strapi);
      await require('./lib/migrate-local-storage')(strapi);
      await require('./lib/migrate-publications')(strapi);
      await require('./lib/migrate-publication-event-date')(strapi);
      await require('./lib/migrate-competition-pages')(strapi);
      await require('./lib/migrate-retire-stages-page')(strapi);
      return;
    }
    const source = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../content/initial.json'), 'utf8'));
    const migration = strapi.store({ type: 'core', name: 'vertical-import', key: 'prototype-cleanup-v1' });
    if (!(await migration.get())) {
      const prototype = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../content/prototype.json'), 'utf8'));
      for (const [key, uid] of Object.entries({ events: 'api::event.event', news: 'api::article.article' })) {
        for (const item of prototype[key]) {
          const existing = await strapi.documents(uid).findFirst({ filters: { slug: item.slug } });
          // Remove only unchanged prototype entries; preserve anything edited by the club.
          if (existing && !existing.sourceId && Object.entries(item).every(([field, value]) => JSON.stringify(existing[field]) === JSON.stringify(value))) {
            await strapi.documents(uid).delete({ documentId: existing.documentId });
          }
        }
      }
      await migration.set({ value: { completed: true } });
    }
    for (const [key, uid] of Object.entries({ activities: 'api::activity.activity', events: 'api::event.event', news: 'api::article.article', pages: 'api::page.page' })) {
      for (const item of source[key]) {
        const existing = await strapi.documents(uid).findFirst({ filters: { slug: item.slug } });
        if (!existing) await strapi.documents(uid).create({ data: item, status: 'published' });
      }
    }
    const gallery = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../content/gallery.json'), 'utf8'));
    for (const album of gallery) {
      if (!(await strapi.documents('api::album.album').findFirst({ filters: { sourceId: album.sourceId } }))) {
        await strapi.documents('api::album.album').create({ data: album, status: 'published' });
      }
    }
    strapi.log.info('Contenus initiaux vérifiés (sans écraser les modifications existantes).');
    await require('./lib/migrate-timetable')(strapi);
    await require('./lib/migrate-media')(strapi);
    await require('./lib/link-inline-media')(strapi);
    await require('./lib/migrate-club-content')(strapi);
    await require('./lib/migrate-competition-photo')(strapi);
    await require('./lib/migrate-local-storage')(strapi);
    await require('./lib/migrate-publications')(strapi);
    await require('./lib/migrate-publication-event-date')(strapi);
    await require('./lib/migrate-competition-pages')(strapi);
    await require('./lib/migrate-retire-stages-page')(strapi);
  },
};
