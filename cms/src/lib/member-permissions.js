const editorial=new Set(['title','body','category','meeting','photos']);
module.exports=function memberPermissions(user) {
  const contributor=user?.role?.type==='contributor'&&!user.blocked;
  const own=entity=>contributor&&(!entity||(typeof entity.memberAuthor==='number'?entity.memberAuthor:entity.memberAuthor?.id)===user.id);
  const clean=data=>Object.fromEntries(Object.entries(data).filter(([key])=>editorial.has(key)));
  return {isMember:true,
    can:{create:()=>contributor,read:own,update:own,publish:own},
    cannot:{create:()=>!contributor,read:entity=>!own(entity),update:entity=>!own(entity),publish:entity=>!own(entity)},
    sanitizeCreateInput:async data=>clean(data),
    sanitizeUpdateInput:()=>async data=>clean(data),
    sanitizeOutput:async data=>({...clean(data),photos:data.photos||[]}),
  };
};
