module.exports={routes:['config','start','callback','pending','link'].map(action=>({
  method:action==='config'?'GET':'POST',path:'/auth/google/'+action,handler:'member-google.'+action,
  config:{auth:false,middlewares:['plugin::users-permissions.rateLimit']},
}))};
