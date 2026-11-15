module.exports=async function configureMemberEmail(strapi) {
  const settings=strapi.store({type:'plugin',name:'users-permissions'});
  const advanced=await settings.get({key:'advanced'});
  const site=process.env.PUBLIC_SITE_URL||(process.env.NODE_ENV==='production'?'':'http://localhost:3000');
  if(site) {
    const url=new URL(site);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash)throw Error('PUBLIC_SITE_URL invalide.');
    await settings.set({key:'advanced',value:{...advanced,email_reset_password:url.origin+'/reinitialiser-mot-de-passe'}});
  }
  const marker=strapi.store({type:'core',name:'vertical-admin',key:'member-reset-email-v1'});
  const initialized=await marker.get();
  const emails=await settings.get({key:'email'});
  const from=process.env.EMAIL_FROM||process.env.SMTP_USER||'no-reply@vertical-cotiere.fr';
  await settings.set({key:'email',value:{...emails,reset_password:{...emails.reset_password,options:{...emails.reset_password?.options,
    ...(!initialized||process.env.EMAIL_FROM||process.env.SMTP_USER?{from:{name:'Vertical Côtière',email:from},response_email:from}:{}),
    ...(!initialized?{
    object:'Votre nouveau mot de passe — Vertical Côtière',
    message:'<p>Bonjour,</p><p>Une demande de réinitialisation de votre mot de passe a été faite sur Vertical Côtière.</p><p><a href="<%= URL %>?code=<%= TOKEN %>">Choisir un nouveau mot de passe</a></p><p>Ce lien est valable une heure et ne peut être utilisé qu’une fois.</p><p>Si vous n’êtes pas à l’origine de cette demande, vous pouvez ignorer cet e-mail. Votre mot de passe reste inchangé.</p><p>L’équipe Vertical Côtière</p>',
    }:{}),
  }}}});
  await marker.set({value:true});
};
