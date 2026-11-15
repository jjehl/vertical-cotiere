module.exports={routes:[
  ['GET','/member/me','me'],['PUT','/member/profile','updateProfile'],['POST','/member/password','password'],
  ['GET','/member/publications','publications'],['POST','/member/photos','photos'],['GET','/member/photos/:id','photo'],
  ['GET','/member/assistant/status','assistantStatus'],['GET','/member/assistant/publications/:documentId','assistantPublication'],
  ['POST','/member/assistant/prepare','assistantPrepare'],['POST','/member/assistant/confirm','assistantConfirm'],
].map(([method,path,action])=>({method,path,handler:'member.'+action,config:{auth:{scope:['api::member.member.'+action]}}}))};
