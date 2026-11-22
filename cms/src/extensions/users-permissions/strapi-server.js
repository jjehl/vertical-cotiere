const {fields}=require('../../lib/member-profile');
module.exports=plugin=>{
  plugin.contentTypes.user.schema.info.displayName='Membre';
  for(const [name,maxLength] of Object.entries(fields))plugin.contentTypes.user.schema.attributes[name]={type:'string',maxLength,private:true};
  plugin.contentTypes.user.schema.attributes.password.minLength=12;
  plugin.contentTypes.user.schema.attributes.provider.default='local';
  plugin.contentTypes.user.schema.attributes.googleSubject={type:'string',unique:true,private:true,configurable:false,pluginOptions:{'content-manager':{visible:false}}};
  plugin.contentTypes.user.schema.attributes.resetPasswordExpiresAt={type:'datetime',private:true,configurable:false,pluginOptions:{'content-manager':{visible:false}}};
  for(const [name,type] of Object.entries({membershipBirthDate:'date',ffmeLicenseValidUntil:'date',clubMembershipValidUntil:'date',registrationInviteToken:'string',registrationInviteExpiresAt:'datetime',registrationInviteSentAt:'datetime'}))plugin.contentTypes.user.schema.attributes[name]={type,private:true,configurable:false,pluginOptions:{'content-manager':{visible:false}}};
  const attributes=plugin.contentTypes.user.schema.attributes;
  attributes.competition={type:'boolean',default:false,required:true,private:true,column:{notNullable:true,defaultTo:false}};
  attributes.membershipSheet={type:'json',private:true,configurable:false,pluginOptions:{'content-manager':{visible:false}}};
  const familyRelation={type:'relation',relation:'manyToMany',target:'plugin::users-permissions.user',private:true};
  attributes.guardians={...familyRelation,inversedBy:'dependents'};
  attributes.dependents={...familyRelation,mappedBy:'guardians'};
  require('../../lib/member-password-reset')(plugin);
  require('../../lib/member-auth')(plugin);
  return plugin;
};
