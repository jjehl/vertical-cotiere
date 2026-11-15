const {errors}=require('@strapi/utils');
const uid='plugin::users-permissions.user';
module.exports=function extendPasswordReset(plugin) {
  const userService=plugin.services.user;
  plugin.services.user=options=>{
    const service=userService(options);
    return {...service,edit(id,data={}) {
      // Strapi issues and consumes its own random token. Attach an expiry to
      // every issuance, including calls made through the native auth route.
      const update=Object.hasOwn(data,'resetPasswordToken')
        ? {...data,resetPasswordExpiresAt:data.resetPasswordToken?new Date(Date.now()+3600000).toISOString():null}:data;
      return service.edit(id,update);
    }};
  };
  const auth=plugin.controllers.auth;
  plugin.controllers.auth=options=>{
    const {strapi}=options;const controller=auth(options);
    return {...controller,
      async forgotPassword(ctx) {
        const config=strapi.config.get('plugin::email');
        const smtp=config?.providerOptions;
        if(!smtp?.host||!smtp.auth?.user||!smtp.auth?.pass)ctx.throw(503,'L’envoi des e-mails n’est pas encore configuré.');
        const settings=await strapi.store({type:'plugin',name:'users-permissions',key:'advanced'}).get();
        if(!settings?.email_reset_password)ctx.throw(503,'Le lien de récupération n’est pas encore configuré.');
        return controller.forgotPassword(ctx);
      },
      async resetPassword(ctx) {
        const {code}=ctx.request.body||{};
        if(typeof code!=='string'||!(/^[a-f0-9]{128}$/).test(code))throw new errors.ValidationError('Ce lien est invalide ou expiré. Demandez un nouveau lien.');
        return strapi.db.transaction(async({trx})=>{
          // Serialize consumption so a link cannot change a password twice,
          // even when two confirmations arrive simultaneously.
          const {tableName,attributes}=strapi.db.metadata.get(uid);
          await trx(tableName).where({[attributes.resetPasswordToken.columnName]:code}).forUpdate();
          const user=await strapi.db.query(uid).findOne({where:{resetPasswordToken:code}});
          if(!user||user.blocked||user.provider!=='local'||!user.resetPasswordExpiresAt||new Date(user.resetPasswordExpiresAt).getTime()<=Date.now())throw new errors.ValidationError('Ce lien est invalide ou expiré. Demandez un nouveau lien.');
          return controller.resetPassword(ctx);
        });
      },
    };
  };
};
