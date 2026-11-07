const fs = require('node:fs');
const path = require('node:path');
const { validateTimetable } = require('./schedule-validation');
const days = ['Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi','Dimanche'];
const shift = (date, delta) => new Date(new Date(date+'T12:00:00Z').getTime()+delta*86400000).toISOString().slice(0,10);
const time = value => value.length === 5 ? value+':00.000' : value;

module.exports = async function migrateTimetable(strapi) {
  const store = strapi.store({ type:'core', name:'vertical-admin', key:'timetable-v1' });
  if (await store.get()) return;
  const exists = await strapi.documents('api::club-timetable.club-timetable').findFirst({});
  if (!exists) {
    const old = await strapi.documents('api::page.page').findFirst({filters:{slug:'horaires'}});
    if(!old&&process.env.SEED_CONTENT!=='true') return;
    const source = old?.structuredData || JSON.parse(fs.readFileSync(path.join(__dirname,'../../content/timetable.json'),'utf8'));
    const { ufraps } = source;
    const data = {
      season: source.season, note: source.note,
      sessions: source.sessions.map(slot => ({...slot, day:days[slot.day-1], start:time(slot.start),end:time(slot.end)})),
      ufraps: {
        opens:ufraps.opens,closes:ufraps.closes,day:days[ufraps.day-1],start:time(ufraps.start),end:time(ufraps.end),
        closures:ufraps.closures.map(c=>({label:c.label,from:shift(c.lastDay,1),until:shift(c.reopens,-1)})),
        closedDays:ufraps.holidays.map(date=>({date,label:date>='2027-05-06'&&date<='2027-05-09'?'Pont de l’Ascension':'Jour de fermeture'})),
      },
    };
    validateTimetable(data);
    await strapi.documents('api::club-timetable.club-timetable').create({data,status:'published'});
  }
  await store.set({value:{complete:true}});
};
