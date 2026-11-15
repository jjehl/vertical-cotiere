#!/usr/bin/env node
import {createHash} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';
import {pathToFileURL} from 'node:url';

const environments={local:'http://localhost:1337',re7:'https://vertical-cotiere-admin.re7.jehl.org',prod:'https://vertical-cotiere-admin.jehl.org'};
const prefix=name=>'SYNC_'+name.toUpperCase().replace(/-/g,'_');
function normalizeUrl(value){
  let url;try{url=new URL(value);}catch{throw Error('URL de CMS invalide : utiliser local, re7, prod ou une URL complète.');}
  if(url.username||url.password||url.search||url.hash||!['http:','https:'].includes(url.protocol)||
    (url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('Utiliser une URL HTTPS, ou HTTP sur localhost, sans credentials ni paramètres.');
  return url.href.replace(/\/+$/,'');
}
function endpoint(selector,env){
  if(/^[a-z][a-z0-9_-]*$/i.test(selector)){
    const profile=selector.toLowerCase(),address=env[prefix(profile)+'_URL']||environments[profile];
    if(!address)throw Error(`Environnement inconnu : ${selector}. Renseigner ${prefix(profile)}_URL ou utiliser une URL complète.`);
    return {url:normalizeUrl(address),profile};
  }
  const url=normalizeUrl(selector);
  const names=new Set([...Object.keys(environments),...Object.keys(env).filter(key=>/^SYNC_[A-Z0-9_]+_URL$/.test(key)&&!['SYNC_SOURCE_URL','SYNC_TARGET_URL'].includes(key)).map(key=>key.slice(5,-4).toLowerCase())]);
  const matches=[];
  for(const name of names){
    try{if(normalizeUrl(env[prefix(name)+'_URL']||environments[name])===url)matches.push(name);}catch{}
  }
  // An ambiguous URL can still be used with explicitly bound directional tokens.
  return {url,profile:matches.length===1?matches[0]:null};
}
export function options(argv,env=process.env){
  const result={source:env.SYNC_SOURCE_URL||'local',target:env.SYNC_TARGET_URL||'re7',dryRun:false,adoptSlug:false};
  for(let i=0;i<argv.length;i++){
    const arg=argv[i];
    if(arg==='--dry-run')result.dryRun=true;
    else if(arg==='--adopt-slug')result.adoptSlug=true;
    else if(arg==='--help'||arg==='-h')result.help=true;
    else if(['--from','--to','--slug'].includes(arg)){
      const value=argv[++i];if(!value||value.startsWith('--'))throw Error('Valeur requise après '+arg);
      result[arg==='--from'?'source':arg==='--to'?'target':'slug']=value;
    }else throw Error('Option inconnue : '+arg);
  }
  for(const key of ['source','target']){
    const resolved=endpoint(result[key],env);result[key]=resolved.url;result[key+'Profile']=resolved.profile;
  }
  if(result.source===result.target&&!result.help)throw Error('La source et la destination doivent être distinctes.');
  if(result.adoptSlug&&!result.slug)throw Error('--adopt-slug nécessite --slug pour rapprocher une seule publication.');
  if(result.slug&&!(/^[a-zA-Z0-9_-]{1,200}$/).test(result.slug))throw Error('Slug invalide.');
  return result;
}
export function tokens(config,env=process.env){
  const result={};
  for(const [side,role] of [['source','EXPORT'],['target','IMPORT']]){
    const profile=config[side+'Profile'];
    const specific=profile&&env[prefix(profile)+'_'+role+'_TOKEN'];
    if(specific){result[side+'Token']=specific;continue;}
    // Keep old directional credentials bound to their URL when the direction changes.
    const key=side==='source'?'SYNC_SOURCE':'SYNC_TARGET';
    const boundUrl=env[key+'_URL'];
    let matches=false;
    try{matches=boundUrl?endpoint(boundUrl,env).url===config[side]:!profile||config[side]===environments[side==='source'?'local':'re7'];}catch{}
    result[side+'Token']=matches?env[key+'_TOKEN']:undefined;
  }
  return result;
}
export async function run(config,{sourceToken,targetToken,log=console.log}={}){
  if(!sourceToken||!targetToken){const resolved=tokens(config);sourceToken||=resolved.sourceToken;targetToken||=resolved.targetToken;}
  if(!sourceToken||!targetToken){
    const missing=[!sourceToken&&(config.sourceProfile?prefix(config.sourceProfile)+'_EXPORT_TOKEN':'SYNC_SOURCE_TOKEN'),!targetToken&&(config.targetProfile?prefix(config.targetProfile)+'_IMPORT_TOKEN':'SYNC_TARGET_TOKEN')].filter(Boolean);
    throw Error('Renseigner '+missing.join(' et ')+'.');
  }
  const request=async(side,path,{method='GET',json,form}={})=>{
    for(let attempt=0;;attempt++){
      let response;
      try{
        response=await fetch(config[side]+path,{method,redirect:'error',signal:AbortSignal.timeout(120000),headers:{Authorization:'Bearer '+(side==='source'?sourceToken:targetToken),...(json?{'Content-Type':'application/json'}:{})},...(json?{body:JSON.stringify(json)}:form?{body:form}: {})});
      }catch{if(attempt<2)continue;throw Error('Connexion impossible au CMS '+side+'.');}
      if([429,502,503,504].includes(response.status)&&attempt<2){await response.body?.cancel();await new Promise(resolve=>setTimeout(resolve,1000));continue;}
      if(!response.ok){await response.body?.cancel();throw Error(`CMS ${side} : HTTP ${response.status} (${path.split('?')[0]}).`);}
      return response;
    }
  };
  const jsonRequest=async(side,path,body)=>(await request(side,path,body?{method:'POST',json:body}:{})).json();
  const directory=await mkdtemp(join(tmpdir(),'vertical-sync-')),cache=new Map();
  const summary={create:0,update:0,unchanged:0,conflict:0,failed:0};
  log(`${config.dryRun?'Aperçu':'Transfert'} : ${config.sourceProfile?config.sourceProfile+' (':''}${config.source}${config.sourceProfile?')':''} → ${config.targetProfile?config.targetProfile+' (':''}${config.target}${config.targetProfile?')':''}`);
  log('Lecture des fichiers originaux pour vérifier leurs empreintes. Aucune suppression automatique.');
  try{
    let page=1,pageCount=1,seen=0;
    do{
      const query=new URLSearchParams({page:String(page),pageSize:'10',...(config.slug?{slug:config.slug}:{})});
      const batch=await jsonRequest('source','/api/content-sync/export?'+query);
      if(batch.version!==1||!Array.isArray(batch.publications)||!batch.pagination)throw Error('Format d’export incompatible.');
      pageCount=batch.pagination.pageCount;
      for(const publication of batch.publications){
        seen++;
        try{
          for(const file of publication.files){
            const key=publication.sourceId+':'+file.id;
            if(!cache.has(key)){
              const response=await request('source','/api/content-sync/files/'+encodeURIComponent(file.id));
              const filepath=join(directory,createHash('sha256').update(key).digest('hex'));
              const hash=createHash('sha256');let size=0;
              const measure=new Transform({transform(chunk,encoding,callback){size+=chunk.length;if(size>50*1024*1024)return callback(Error('Fichier supérieur à 50 Mo.'));hash.update(chunk);callback(null,chunk);}});
              await pipeline(Readable.fromWeb(response.body),measure,createWriteStream(filepath,{mode:0o600}));
              cache.set(key,{filepath,sha256:hash.digest('hex')});
            }
            file.sha256=cache.get(key).sha256;
          }
          const payload={publication,adoptSlug:config.adoptSlug};
          let result=await jsonRequest('target','/api/content-sync/plan',payload);
          if(!config.dryRun&&result.action!=='conflict'){
            for(const file of result.missingFiles){
              const cached=cache.get(publication.sourceId+':'+file.id);
              const form=new FormData();
              form.append('metadata',JSON.stringify(file));
              form.append('files',new Blob([await readFile(cached.filepath)],{type:file.mime}),file.name);
              await(await request('target','/api/content-sync/files',{method:'POST',form})).json();
            }
            result=await jsonRequest('target','/api/content-sync/import',payload);
          }
          if(!Object.hasOwn(summary,result.action))throw Error('Réponse d’import incompatible.');
          summary[result.action]++;
          log(`${result.action} : ${publication.draft.slug}${result.conflicts?.length?' — '+result.conflicts.join(', '):''}${result.adopted?' (rapprochement par slug)':''}`);
        }catch(error){summary.failed++;log(`Erreur : ${publication.draft?.slug||publication.documentId} — ${error.message}`);}
      }
      page++;
    }while(page<=pageCount);
    if(!seen)log('Aucune publication trouvée.');
    log(`${config.dryRun?'Prévu':'Résultat'} : ${summary.create} créations, ${summary.update} mises à jour, ${summary.unchanged} inchangées, ${summary.conflict} conflits, ${summary.failed} erreurs.`);
    return summary;
  }finally{await rm(directory,{recursive:true,force:true});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const config=options(process.argv.slice(2));
    if(config.help)console.log('Usage : ./sync-publications.sh --from SOURCE --to CIBLE [--dry-run] [--slug SLUG [--adopt-slug]]\nSource et cible : local, re7, prod, un profil SYNC_<NOM>_URL ou une URL complète.\nPar défaut : local → re7. Jetons : SYNC_<ENV>_EXPORT_TOKEN et SYNC_<ENV>_IMPORT_TOKEN.\nExemples : --from re7 --to prod --dry-run ; --from prod --to local --dry-run.\nURLs libres : SYNC_SOURCE_URL/TOKEN et SYNC_TARGET_URL/TOKEN.');
    else {const result=await run(config);if(result.conflict||result.failed)process.exitCode=2;}
  }catch(error){console.error(error.message);process.exitCode=1;}
}
