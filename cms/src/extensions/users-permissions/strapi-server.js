const {fields}=require('../../lib/member-profile');
module.exports=plugin=>{
  plugin.contentTypes.user.schema.info.displayName='Membre';
  for(const [name,maxLength] of Object.entries(fields))plugin.contentTypes.user.schema.attributes[name]={type:'string',maxLength,private:true};
  plugin.contentTypes.user.schema.attributes.password.minLength=12;
  plugin.contentTypes.user.schema.attributes.provider.default='local';
  plugin.contentTypes.user.schema.attributes.resetPasswordExpiresAt={type:'datetime',private:true,configurable:false,pluginOptions:{'content-manager':{visible:false}}};
  require('../../lib/member-password-reset')(plugin);
  return plugin;
};
