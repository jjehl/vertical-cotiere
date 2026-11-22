const {errors}=require('@strapi/utils');
const {validateProfile}=require('./member-profile');
const uid='plugin::users-permissions.user';
const invalid=()=>new errors.ValidationError('Identifiant ou mot de passe invalide.');

module.exports=function extendMemberAuth(plugin) {
  const auth=plugin.controllers.auth;
  plugin.controllers.auth=options=>{
    const {strapi}=options;const controller=auth(options);
    const settings=()=>strapi.store({type:'plugin',name:'users-permissions',key:'advanced'}).get();
    async function authenticated(ctx,user) {
      const sanitized=await strapi.contentAPI.sanitize.output(user,strapi.getModel(uid),{auth:ctx.state.auth});
      return ctx.send({jwt:strapi.plugin('users-permissions').service('jwt').issue({id:user.id}),user:sanitized});
    }
    return {...controller,
      async callback(ctx) {
        // Google uses the dedicated flow: never fall back to Strapi's email matching.
        if(ctx.params.provider==='google')throw invalid();
        if(ctx.params.provider&&ctx.params.provider!=='local')return controller.callback(ctx);
        ctx.set('Cache-Control','private, no-store');
        const body=ctx.request.body;
        if(!body||typeof body.identifier!=='string'||!body.identifier.trim()||body.identifier.length>254||Object.keys(body).some(key=>!['identifier','password','accountId'].includes(key)))throw invalid();
        if(body.accountId!==undefined&&(!Number.isSafeInteger(body.accountId)||body.accountId<1))throw invalid();
        const grant=await strapi.store({type:'plugin',name:'users-permissions',key:'grant'}).get();
        if(!grant?.email?.enabled)throw invalid();
        const identifier=body.identifier.trim();const query=strapi.db.query(uid);
        // Email addresses may name several accounts. Never let findOne choose
        // an arbitrary account, even if those accounts share a password.
        let users=identifier.includes('@')?await query.findMany({where:{provider:'local',email:{$eqi:identifier}},orderBy:{username:'asc'}}):[];
        if(!users.length)users=await query.findMany({where:{provider:'local',username:identifier}});
        if(users.length>1&&body.accountId===undefined)return ctx.send({accounts:users.map(({id,username,firstName,lastName})=>({id,username,firstName:firstName||'',lastName:lastName||''}))});
        const user=body.accountId===undefined?users[0]:users.find(user=>user.id===body.accountId);
        if(!user||typeof body.password!=='string'||!body.password||body.password.length>256||!user.password||!await strapi.plugin('users-permissions').service('user').validatePassword(body.password,user.password))throw invalid();
        const advanced=await settings();
        if(user.blocked||(advanced.email_confirmation&&!user.confirmed))throw invalid();
        return authenticated(ctx,user);
      },
      async register(ctx) {
        const advanced=await settings();
        if(!advanced.allow_register)throw new errors.ApplicationError('La création de compte est désactivée.');
        const body=ctx.request.body;
        if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!['username','email','password','firstName','lastName'].includes(key)))throw new errors.ValidationError('Paramètres de création de compte invalides.');
        const data=validateProfile(Object.fromEntries(['email','firstName','lastName'].filter(key=>Object.hasOwn(body,key)).map(key=>[key,body[key]])));
        if(!data.email||typeof body.username!=='string'||body.username.trim().length<3||body.username.trim().length>254||/\s/.test(body.username.trim()))throw new errors.ValidationError('Choisissez un identifiant unique de 3 à 254 caractères, sans espace.');
        if(typeof body.password!=='string'||body.password.length<12||Buffer.byteLength(body.password,'utf8')>72)throw new errors.ValidationError('Choisissez au moins 12 caractères (72 octets maximum).');
        const username=body.username.trim();
        const role=await strapi.db.query('plugin::users-permissions.role').findOne({where:{type:advanced.default_role}});
        if(!role)throw new errors.ApplicationError('Rôle membre introuvable.');
        const service=strapi.plugin('users-permissions').service('user');
        let user;
        try{
          user=await strapi.db.transaction(async({trx})=>{
            await trx.raw('SELECT pg_advisory_xact_lock(2672027)');
            if(await strapi.db.query(uid).findOne({where:{$or:[{username:{$eqi:username}},{legacyDirectoryUsername:{$eqi:username}}]},select:['id']}))throw new errors.ValidationError('Cet identifiant est déjà utilisé.');
            return service.add({...data,username,password:body.password,provider:'local',role:role.id,confirmed:!advanced.email_confirmation});
          });
        }
        catch(error){if(error.code==='23505'||error.cause?.code==='23505')throw new errors.ValidationError('Cet identifiant est déjà utilisé.');throw error;}
        if(advanced.email_confirmation) {
          await service.sendConfirmationEmail(user);
          return ctx.send({requiresConfirmation:true});
        }
        return authenticated(ctx,user);
      },
    };
  };
};
