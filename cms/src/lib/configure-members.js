module.exports=async function configureMembers(strapi) {
  await require('./configure-member-email')(strapi);
  const roles=strapi.db.query('plugin::users-permissions.role');
  const basic=await roles.findOne({where:{type:'authenticated'}});
  if(!basic)throw Error('Rôle membre par défaut introuvable.');
  let contributor=await roles.findOne({where:{type:'contributor'}});
  if(!contributor)contributor=await roles.create({data:{name:'Contributeur',description:'Profil et gestion de ses propres publications depuis le site.',type:'contributor'}});
  await roles.update({where:{id:basic.id},data:{name:'Utilisateur basique',description:'Consultation et modification de son profil personnel.'}});
  const permissions=strapi.db.query('plugin::users-permissions.permission');
  const profile=['me','updateProfile','password','publicationPhotoIds','deletePublicationPhoto','participationPoll','registerParticipation','searchParticipationMembers'];
  const contribution=['publications','assistantStatus','assistantPublication','assistantPrepare','assistantConfirm','photos','photo','publicationPhotos','createParticipationPoll'];
  for(const role of [basic,contributor]) {
    for(const name of ['checkout','status']) {
      const action='api::course-registration.course-registration.'+name;
      if(!await permissions.findOne({where:{role:role.id,action}}))await permissions.create({data:{role:role.id,action}});
    }
    for(const action of [...profile,...(role.id===contributor.id?contribution:[])].map(name=>'api::member.member.'+name)) {
      if(!await permissions.findOne({where:{role:role.id,action}}))await permissions.create({data:{role:role.id,action}});
    }
  }
  // No member role has a generic user directory or can edit arbitrary users.
  const publicRole=await roles.findOne({where:{type:'public'}});
  for(const role of [publicRole,basic,contributor].filter(Boolean)) {
    await permissions.deleteMany({where:{role:role.id,action:{$startsWith:'plugin::users-permissions.user.'}}});
  }
  const advanced=strapi.store({type:'plugin',name:'users-permissions',key:'advanced'});
  await advanced.set({value:{...(await advanced.get()),allow_register:true,default_role:'authenticated',unique_email:false}});
  const marker=strapi.store({type:'core',name:'vertical-admin',key:'member-profile-form-v1'});
  if(!await marker.get()) {
    const model=strapi.contentTypes['plugin::users-permissions.user'];
    const service=strapi.plugin('content-manager').service('content-types');
    const config=await service.findConfiguration(model);
    const labels={firstName:'Prénom',lastName:'Nom',email:'E-mail',phone:'Téléphone',street:'Adresse',postalCode:'Code postal',city:'Ville',country:'Pays',ffmeLicenseNumber:'Numéro de licence FFME',role:'Rôle membre'};
    for(const [key,label] of Object.entries(labels))if(config.metadatas[key])config.metadatas[key].edit={...config.metadatas[key].edit,label,visible:true};
    config.layouts.edit=[['firstName','lastName'],['username','email'],['phone','ffmeLicenseNumber'],['street'],['postalCode','city'],['country'],['password'],['role'],['confirmed','blocked']].map(row=>row.map(name=>({name,size:row.length===1?12:6})));
    config.layouts.list=['firstName','lastName','email','role'];
    await service.updateConfiguration(model,config);
    await marker.set({value:true});
  }
};
