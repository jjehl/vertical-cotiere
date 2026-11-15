const google=require('../../../lib/member-google');
module.exports={
  async config(ctx){ctx.set('Cache-Control','private, no-store');ctx.body={enabled:Boolean(google.configuration())};},
  start:ctx=>google.start(strapi,ctx),
  callback:ctx=>google.callback(strapi,ctx),
  pending:ctx=>google.pending(strapi,ctx),
  link:ctx=>google.link(strapi,ctx),
};
