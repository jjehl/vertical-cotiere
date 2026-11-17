const model=require('./content-sync-members-model');
const {store,locked,instanceId,publicPlan}=require('./content-sync-service');
const {equal}=require('./content-sync-model');
const {memberTypes}=require('./member-roles');
const uid='plugin::users-permissions.user';
const fail=(status,message)=>{const error=Error(message);error.status=status;throw error;};
async function exportPage(app,{page=1,pageSize=10}={}){
  const sourceId=await instanceId(app),users=app.db.query(uid);
  const where={provider:'local',role:{type:{$in:memberTypes}}};
  const total=await users.count({where});
  const rows=await users.findMany({where,orderBy:{id:'asc'},offset:(page-1)*pageSize,limit:pageSize,populate:{role:true}});
  const contents=rows.map(row=>({version:2,type:'members',sourceId,documentId:row.documentId,draft:model.dataFromRow(row),published:null,files:[],dependencies:[]}));
  return {version:2,type:'members',sourceId,contents,pagination:{page,pageSize,total,pageCount:Math.ceil(total/pageSize)}};
}
async function plan(app,content,{trx}={}){
  model.validateContent(content);
  if(content.sourceId===await store(app,'instance').get())fail(400,'La source et la destination sont la même instance.');
  const key=model.key(content),record=await store(app,key).get(),users=app.db.query(uid);
  if(trx&&record){const meta=app.db.metadata.get(uid);await trx(meta.tableName).where(meta.attributes.documentId.columnName,record.documentId).forUpdate();}
  const row=record?await users.findOne({where:{documentId:record.documentId},populate:{role:true}}):null;
  const conflict=message=>({action:'conflict',conflicts:[message],key,documentId:record?.documentId});
  if(record&&!row)return conflict('Membre supprimé en destination.');
  if(row&&(row.provider!=='local'||!memberTypes.includes(row.role?.type)))return conflict('Le compte cible ne possède plus un rôle membre compatible.');
  const collision=await users.findOne({where:{username:{$eqi:content.draft.username},...(row?{id:{$ne:row.id}}:{})}});
  if(collision)return conflict('Identifiant déjà utilisé en destination. Aucun rapprochement automatique.');
  const role=await app.db.query('plugin::users-permissions.role').findOne({where:{type:content.draft.role}});
  if(!role)return conflict('Rôle membre absent en destination : '+content.draft.role);
  const current=row?model.dataFromRow(row):null;
  const merged=model.merge(content.draft,record?.source,current,record?.target);
  if(merged.conflicts.length)return {action:'conflict',conflicts:merged.conflicts,key,documentId:row.documentId};
  // Resolve the merged role too: a target-only role edit must remain in place.
  const targetRole=await app.db.query('plugin::users-permissions.role').findOne({where:{type:merged.data.role}});
  if(!targetRole)return conflict('Rôle membre absent en destination.');
  return {action:!row?'create':equal(current,merged.data)?'unchanged':'update',key,documentId:row?.documentId,id:row?.id,roleId:targetRole.id,incoming:model.snapshot(content.draft),merged:merged.data,baseline:merged.baseline};
}
async function importContent(app,content,options){
  return locked(app,async trx=>{
    const result=await plan(app,content,{...options,trx});
    if(result.action==='conflict')return publicPlan(result);
    const users=app.db.query(uid);let documentId=result.documentId;
    if(result.action!=='unchanged'){
      const {passwordHash,role,...profile}=result.merged;
      // Query Engine deliberately preserves the already validated bcrypt hash.
      // Document Service would hash it again and make the password unusable.
      const data={...profile,password:passwordHash,role:result.roleId};
      if(result.action==='create'){
        const row=await users.create({data:{...data,provider:'local'}});documentId=row.documentId;
      }else{
        await users.update({where:{id:result.id},data});
      }
    }
    await store(app,result.key).set({value:{documentId,source:result.incoming,target:result.baseline}});
    return {...publicPlan(result),documentId};
  });
}
module.exports={exportPage,plan,publicPlan,importContent};
