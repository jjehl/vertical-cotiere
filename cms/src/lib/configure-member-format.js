const {errors}=require('@strapi/utils');
const {contactFields,formatChanges}=require('./member-format');
const uid='plugin::users-permissions.user';

module.exports=async function configureMemberFormat(app) {
  const users=app.db.query(uid);
  async function beforeWrite({action,params:{data,where}}) {
    if (!data || !contactFields.some(key=>Object.hasOwn(data,key)) && !Object.hasOwn(data,'country')) return;
    let previous;
    if (action==='beforeUpdate' && ['postalCode','phone','country'].some(key=>Object.hasOwn(data,key))) {
      previous=await users.findOne({where,select:['country','postalCode','phone']});
      if (Object.hasOwn(data,'country') && data.country!==previous?.country && previous?.postalCode && !Object.hasOwn(data,'postalCode')) data.postalCode=previous.postalCode;
    }
    const country=Object.hasOwn(data,'country') ? data.country : previous?.country;
    Object.assign(data,formatChanges(data,country,(key,message)=>{
      if (data[key]!==previous?.[key] || country!==previous?.country) throw new errors.ValidationError(message);
    }));
  }
  app.db.lifecycles.subscribe({models:[uid],beforeCreate:beforeWrite,beforeUpdate:beforeWrite});

  const marker=app.store({type:'core',name:'vertical-admin',key:'member-coordinate-format-v1'});
  if (await marker.get()) return;
  const {tableName,attributes}=app.db.metadata.get(uid);
  const columns=Object.fromEntries(['id','country',...contactFields].map(key=>[key,attributes[key].columnName]));
  let lastId=0,updated=0;
  const unresolved={};
  while (true) {
    const count=await app.db.connection.transaction(async trx=>{
      const rows=await trx(tableName).select(columns).where('id','>',lastId).orderBy('id').limit(250).forUpdate();
      for (const row of rows) {
        const changes=formatChanges(row,row.country,key=>{unresolved[key]=(unresolved[key]||0)+1;});
        if (Object.keys(changes).length) {
          await trx(tableName).where({id:row.id}).update(Object.fromEntries(Object.entries(changes).map(([key,value])=>[columns[key],value])));
          updated++;
        }
        lastId=row.id;
      }
      return rows.length;
    });
    if (count<250) break;
  }
  await marker.set({value:{updated,unresolved}});
  app.log.info('Normalisation des coordonnées membres : '+updated+' fiches mises à jour. Champs à vérifier : '+JSON.stringify(unresolved));
};
