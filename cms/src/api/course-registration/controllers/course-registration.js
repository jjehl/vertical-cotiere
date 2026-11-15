const service=require('../../../lib/course-registrations');
module.exports=Object.fromEntries(['catalog','checkout','status','webhook','activate'].map(action=>[action,ctx=>service[action](strapi,ctx)]));
