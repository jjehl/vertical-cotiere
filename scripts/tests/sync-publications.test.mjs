import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import {options,tokens,run} from '../sync-publications.mjs';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';

test('Un upload refusé indique le fichier et le diagnostic 422, sans exposer une erreur interne 500',async()=>{
  const bytes=Buffer.from('image'),logs=[];
  const file={id:'756',name:'12072019-DSC 0027.jpg',mime:'image/jpeg',alternativeText:'',caption:''};
  const publication={version:1,sourceId:'source',documentId:'publication',draft:{slug:'18-2019-07-12'},published:null,files:[file]};
  let status=422,imports=0;
  const server=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://localhost');
    const send=body=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
    if(url.pathname==='/source/api/content-sync/export')return send({version:1,publications:[publication],pagination:{pageCount:1}});
    if(url.pathname==='/source/api/content-sync/files/756')return res.end(bytes);
    for await(const chunk of req){};
    if(url.pathname==='/target/api/content-sync/plan')return send({action:'create',missingFiles:[file]});
    if(url.pathname==='/target/api/content-sync/import')imports++;
    res.statusCode=status;send({error:{message:status===422?'Image illisible : remplacer le fichier source.':'private-stack-trace'}});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address='http://127.0.0.1:'+server.address().port;
  const config={source:address+'/source',target:address+'/target',type:'publications'};
  const credentials={sourceToken:'read',targetToken:'write',log:value=>logs.push(value)};
  try{
    assert.equal((await run(config,credentials)).failed,1);
    assert(logs.some(line=>line.includes(file.name)&&line.includes('source 756')&&line.includes('HTTP 422')&&line.includes('remplacer le fichier source')));
    status=500;logs.length=0;assert.equal((await run(config,credentials)).failed,1);
    assert(logs.some(line=>line.includes(file.name)&&line.includes('HTTP 500')));
    assert(!logs.join('\n').includes('private-stack-trace'));assert.equal(imports,0);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('Members reste explicite, utilise ses routes dédiées et ne journalise pas les données du profil',async()=>{
  assert.equal(options(['--type','members'],{}).type,'members');
  assert.throws(()=>options(['--type','members','--slug','member'],{}),/ni --slug/);
  assert.throws(()=>options(['--type','members','--adopt-slug'],{}),/ni --slug/);
  let imports=0;const exports=[],logs=[];
  const member={version:2,type:'members',sourceId:'source',documentId:'member-id',draft:{username:'private.member',email:'private@example.test',passwordHash:'private-hash'},published:null,files:[],dependencies:[]};
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      const send=body=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
      if(url.pathname.endsWith('/export')){
        const type=url.pathname.includes('/members/')?'members':url.searchParams.get('type')||'publications';exports.push(type);
        assert.equal(req.headers.authorization,'Bearer read');
        return send(type==='publications'?{version:1,publications:[],pagination:{pageCount:0}}:{version:2,type,contents:type==='members'?[member]:[],pagination:{pageCount:type==='members'?1:0}});
      }
      assert.equal(req.headers.authorization,'Bearer write');
      let raw='';for await(const chunk of req)raw+=chunk;assert.deepEqual(JSON.parse(raw).content,member);
      if(url.pathname==='/target/api/content-sync/members/plan')return send({action:imports?'unchanged':'create',missingFiles:[]});
      assert.equal(url.pathname,'/target/api/content-sync/members/import');const action=imports?'unchanged':'create';imports++;send({action});
    }catch(error){res.writeHead(500);res.end(error.message);}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address='http://127.0.0.1:'+server.address().port,config={source:address+'/source',target:address+'/target',type:'members',dryRun:true};
  const credentials={sourceToken:'read',targetToken:'write',log:value=>logs.push(value)};
  try{
    assert.equal((await run(config,credentials)).create,1);assert.equal(imports,0);
    config.dryRun=false;assert.equal((await run(config,credentials)).create,1);assert.equal((await run(config,credentials)).unchanged,1);
    assert(!logs.join('\n').includes('private'));
    exports.length=0;config.type='all';assert.equal((await run(config,credentials)).failed,0);
    assert.deepEqual(exports,['documents','activities','pages','timetable','publications']);assert.equal(imports,2);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('Sélection des contenus du site et rapprochement limité à un type et un slug',()=>{
  assert.equal(options(['--type','all'],{}).type,'all');
  assert.equal(options(['--type','timetable','--slug','club-timetable','--adopt-slug'],{}).type,'timetable');
  assert.throws(()=>options(['--type','all','--slug','page','--adopt-slug'],{}),/un seul --type/);
  assert.throws(()=>options(['--type','timetable','--slug','inconnu'],{}),/club-timetable/);
  assert.throws(()=>options(['--type','users'],{}),/Type inconnu/);
});

test('Pages seules et site complet : dépendances avant les pages, empreintes, cache et ancien format publication',async()=>{
  const bytes=Buffer.from('document de recette'),sha256=createHash('sha256').update(bytes).digest('hex');
  const descriptor={id:'1',name:'document.pdf',mime:'application/pdf',alternativeText:'',caption:''};
  const content=type=>({version:2,type,sourceId:'source',documentId:type,draft:{slug:type},published:null,files:[{...descriptor}],dependencies:[]});
  const contents={documents:content('documents'),activities:content('activities'),timetable:content('timetable')};
  contents.pages={...content('pages'),dependencies:[structuredClone(contents.documents)]};
  contents.publications={version:1,sourceId:'source',documentId:'publications',draft:{slug:'publication'},published:null,files:[{...descriptor}]};
  const imported=new Set(),order=[];let downloads=0,uploads=0;
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://local.invalid');const send=body=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
      if(url.pathname==='/source/api/content-sync/export'){
        const type=url.searchParams.get('type')||'publications';
        return send(type==='publications'?{version:1,publications:[contents.publications],pagination:{pageCount:1}}:{version:2,type,contents:[contents[type]],pagination:{pageCount:1}});
      }
      if(url.pathname==='/source/api/content-sync/files/1'){downloads++;res.end(bytes);return;}
      let raw='';for await(const part of req)raw+=part;
      if(url.pathname==='/target/api/content-sync/files'){uploads++;return send({id:42});}
      const payload=JSON.parse(raw),item=payload.content||payload.publication,type=item.type||'publications';
      assert.equal(item.files[0].sha256,sha256);
      if(type==='pages')assert.equal(item.dependencies[0].files[0].sha256,sha256);
      const action=imported.has(type)?'unchanged':'create';
      if(url.pathname.endsWith('/plan'))return send({action,missingFiles:uploads?[]:item.files});
      assert(url.pathname.endsWith('/import'));if(type==='pages')assert(imported.has('documents'));
      order.push(type);imported.add(type);send({action});
    }catch(error){res.writeHead(500);res.end(error.message);}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address='http://127.0.0.1:'+server.address().port;
  const config={source:address+'/source',target:address+'/target',type:'pages',dryRun:true,adoptSlug:false};
  const credentials={sourceToken:'read',targetToken:'write',log:()=>{}};
  try{
    const preview=await run(config,credentials);assert.equal(preview.create,2);assert.equal(preview.failed,0);assert.equal(uploads,0);assert.equal(imported.size,0);assert.equal(downloads,1);
    config.dryRun=false;
    const first=await run(config,credentials);assert.equal(first.create,2);assert.deepEqual(order,['documents','pages']);assert.equal(uploads,1);
    config.type='all';
    const all=await run(config,credentials);assert.equal(all.create,3);assert.equal(all.unchanged,2);assert.equal(all.failed,0);assert.equal(uploads,1);
    assert.equal(downloads,3); // One read per run, despite references across five types.
    assert.equal((await run(config,credentials)).unchanged,5);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('Un ancien CMS ne peut pas répondre silencieusement à un transfert de pages',async()=>{
  let writes=0;
  const server=createServer((req,res)=>{if(req.method!=='GET')writes++;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({version:1,publications:[],pagination:{pageCount:0}}));});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const address='http://127.0.0.1:'+server.address().port;
  try{await assert.rejects(()=>run({source:address+'/source',target:address+'/target',type:'all'},{sourceToken:'read',targetToken:'write',log:()=>{}}),/mettre les deux CMS à jour/);assert.equal(writes,0);}
  finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('La commande refuse les URL à risque et le rapprochement global par slug',()=>{
  assert.throws(()=>options(['--to','http://example.com'],{}),/HTTPS/);
  assert.throws(()=>options(['--to','https://secret@example.com'],{}),/credentials/);
  assert.throws(()=>options(['--adopt-slug'],{}),/--slug/);
  assert.throws(()=>options(['--from','https://same.test','--to','https://same.test'],{}),/distinctes/);
  assert.equal(options(['--slug','sortie','--adopt-slug','--dry-run'],{}).dryRun,true);
});

test('Tous les sens sélectionnent les URL et jetons propres à chaque environnement',()=>{
  const profiles=['local','re7','prod'];
  const env=Object.fromEntries(profiles.flatMap(name=>[
    ['SYNC_'+name.toUpperCase()+'_URL',`https://${name}.example.test/cms`],
    ['SYNC_'+name.toUpperCase()+'_EXPORT_TOKEN','export-'+name],
    ['SYNC_'+name.toUpperCase()+'_IMPORT_TOKEN','import-'+name],
  ]));
  for(const source of profiles)for(const target of profiles){
    if(source===target){assert.throws(()=>options(['--from',source,'--to',target],env),/distinctes/);continue;}
    const config=options(['--from',source,'--to',target],env);
    assert.equal(config.source,`https://${source}.example.test/cms`);assert.equal(config.target,`https://${target}.example.test/cms`);
    assert.deepEqual(tokens(config,env),{sourceToken:'export-'+source,targetToken:'import-'+target});
  }
  const extra={...env,SYNC_STAGING_URL:'https://staging.example.test',SYNC_STAGING_EXPORT_TOKEN:'staging-export'};
  const custom=options(['--from','staging','--to','local'],extra);
  assert.equal(tokens(custom,extra).sourceToken,'staging-export');
  assert.equal(options(['--from',env.SYNC_PROD_URL,'--to','local'],env).sourceProfile,'prod');
  assert.throws(()=>options(['--from','inconnu'],{}),/SYNC_INCONNU_URL/);
});

test('Les anciens jetons directionnels restent associés à leur CMS lors d’une inversion',()=>{
  const env={SYNC_SOURCE_URL:'http://localhost:1337',SYNC_SOURCE_TOKEN:'legacy-local',SYNC_TARGET_URL:'https://vertical-cotiere-admin.re7.jehl.org',SYNC_TARGET_TOKEN:'legacy-re7'};
  assert.deepEqual(tokens(options([],env),env),{sourceToken:'legacy-local',targetToken:'legacy-re7'});
  assert.deepEqual(tokens(options(['--from','re7','--to','local'],env),env),{sourceToken:undefined,targetToken:undefined});
  assert.deepEqual(tokens(options(['--from','prod','--to','local'],env),env),{sourceToken:undefined,targetToken:undefined});
  const free={SYNC_SOURCE_URL:'https://source.test/cms',SYNC_SOURCE_TOKEN:'free-source',SYNC_TARGET_URL:'https://target.test/cms',SYNC_TARGET_TOKEN:'free-target'};
  assert.deepEqual(tokens(options([],free),free),{sourceToken:'free-source',targetToken:'free-target'});
  assert.equal(tokens(options(['--from','https://another-source.test'],free),free).sourceToken,undefined);
  const specific={...env,SYNC_LOCAL_EXPORT_TOKEN:'specific-local'};
  assert.equal(tokens(options([],specific),specific).sourceToken,'specific-local');
  assert.deepEqual(tokens(options([],{}),{SYNC_SOURCE_TOKEN:'old-source',SYNC_TARGET_TOKEN:'old-target'}),{sourceToken:'old-source',targetToken:'old-target'});
});

test('La vraie commande transfère dans les six sens avec les droits export/import correspondants',async()=>{
  const profiles=['local','re7','prod'],received=new Map(profiles.map(name=>[name,new Set()]));
  const server=createServer(async(req,res)=>{
    try{
      const match=req.url.match(/^\/(local|re7|prod)\/api\/content-sync\/(export|plan|import)(?:\?|$)/);assert(match);
      const [,profile,action]=match;
      assert.equal(req.headers.authorization,'Bearer '+(action==='export'?'export-':'import-')+profile);
      const send=body=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(body));};
      if(action==='export')return send({version:1,publications:[{sourceId:profile,documentId:'original-'+profile,draft:{slug:'publication-'+profile},published:null,files:[]}],pagination:{page:1,pageCount:1}});
      let text='';for await(const chunk of req)text+=chunk;
      const {publication}=JSON.parse(text);assert.notEqual(publication.sourceId,profile);
      const key=publication.sourceId+':'+publication.documentId;
      const result={action:received.get(profile).has(key)?'unchanged':'create',missingFiles:[]};
      if(action==='import')received.get(profile).add(key);send(result);
    }catch(error){res.writeHead(500);res.end(error.message);}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address='http://127.0.0.1:'+server.address().port;
  const env={...process.env,SYNC_SOURCE_URL:'',SYNC_TARGET_URL:'',SYNC_SOURCE_TOKEN:'wrong-legacy-source',SYNC_TARGET_TOKEN:'wrong-legacy-target'};
  for(const profile of profiles){const key='SYNC_'+profile.toUpperCase();env[key+'_URL']=address+'/'+profile;env[key+'_EXPORT_TOKEN']='export-'+profile;env[key+'_IMPORT_TOKEN']='import-'+profile;}
  const execute=promisify(execFile),script=fileURLToPath(new URL('../sync-publications.mjs',import.meta.url));
  try{
    for(const source of profiles)for(const target of profiles)if(source!==target){
      const args=[script,'--from',source,'--to',target];
      const count=received.get(target).size;
      const preview=await execute(process.execPath,[...args,'--dry-run'],{env});assert.match(preview.stdout,/1 créations/);assert.equal(received.get(target).size,count);
      const transferred=await execute(process.execPath,args,{env});assert.match(transferred.stdout,/1 créations/);
      assert(received.get(target).has(source+':original-'+source));
      const repeated=await execute(process.execPath,args,{env});assert.match(repeated.stdout,/1 inchangées/);
    }
    for(const entries of received.values())assert.equal(entries.size,2);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});

test('Transfert HTTP paginé : aperçu, uploads, relance sans doublons et conflits',async()=>{
  const bytes=Buffer.from('original document bytes'),sha256=createHash('sha256').update(bytes).digest('hex');
  const descriptor={id:'14',name:'document.pdf',mime:'application/pdf',alternativeText:'',caption:''};
  const publications=['sortie','compte-rendu'].map((slug,index)=>({version:1,sourceId:'source-test',documentId:'source-'+index,draft:{slug},published:null,files:[{...descriptor}]}));
  const targetDocuments=new Map();let downloads=0,uploads=0,imports=0,uploaded=false;
  const server=createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      const send=(body,status=200)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
      const source=url.pathname.startsWith('/source/');
      assert.equal(req.headers.authorization,'Bearer '+(source?'source-token':'target-token'));
      if(url.pathname==='/source/api/content-sync/export'){
        const page=Number(url.searchParams.get('page'));return send({version:1,publications:[structuredClone(publications[page-1])],pagination:{page,pageCount:2}});
      }
      if(url.pathname==='/source/api/content-sync/files/14'){downloads++;res.end(bytes);return;}
      if(url.pathname==='/target/api/content-sync/files'){
        const request=new Request('http://localhost/upload',{method:'POST',headers:req.headers,body:Readable.toWeb(req),duplex:'half'});
        const form=await request.formData();assert.equal(JSON.parse(form.get('metadata')).sha256,sha256);assert.deepEqual(Buffer.from(await form.get('files').arrayBuffer()),bytes);
        uploads++;uploaded=true;return send({id:99});
      }
      let text='';for await(const chunk of req)text+=chunk;
      const {publication}=JSON.parse(text);assert.equal(publication.files[0].sha256,sha256);
      const fingerprint=JSON.stringify(publication);
      const action=publication.draft.conflict?'conflict':!targetDocuments.has(publication.documentId)?'create':targetDocuments.get(publication.documentId)===fingerprint?'unchanged':'update';
      if(url.pathname==='/target/api/content-sync/plan')return send({action,missingFiles:uploaded?[]:publication.files,conflicts:action==='conflict'?['draft.body']:[]});
      assert.equal(url.pathname,'/target/api/content-sync/import');assert(uploaded);
      imports++;targetDocuments.set(publication.documentId,fingerprint);send({action});
    }catch(error){res.writeHead(500);res.end(error.message);}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address='http://127.0.0.1:'+server.address().port;
  const config={source:address+'/source',target:address+'/target',dryRun:true,adoptSlug:false};
  const credentials={sourceToken:'source-token',targetToken:'target-token',log:()=>{}};
  try{
    const preview=await run(config,credentials);assert.equal(preview.create,2);assert.equal(uploads,0);assert.equal(imports,0);assert.equal(downloads,1);
    config.dryRun=false;
    const first=await run(config,credentials);assert.equal(first.create,2);assert.equal(uploads,1);assert.equal(targetDocuments.size,2);
    const repeat=await run(config,credentials);assert.equal(repeat.unchanged,2);assert.equal(uploads,1);
    publications[0].draft.conflict=true;
    const conflict=await run(config,credentials);assert.equal(conflict.conflict,1);assert.equal(conflict.unchanged,1);assert.equal(targetDocuments.size,2);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
