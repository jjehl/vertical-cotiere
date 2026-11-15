// Standalone browser recipe: temporary Nuxt server and simulated CMS/Google.
// Run from frontend: node e2e/member-google.cjs (Chromium must be installed).
const {chromium,expect}=require('@playwright/test');
const {createServer}=require('node:http');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const origin='http://127.0.0.1:3108';const cmsOrigin='http://127.0.0.1:1358';
const password='Google-test-password!';const pendingToken='pending-google-test-token';
const profile={id:1,username:'google.basic',email:'family@local.invalid',emailConfirmed:true,firstName:'Camille',lastName:'Martin',phone:'',street:'',postalCode:'',city:'',country:'',ffmeLicenseNumber:'',role:'basic',hasPassword:false,googleConnected:true};
const accounts=[{id:2,username:'parent.martin',firstName:'Parent',lastName:'Martin'},{id:3,username:'enfant.martin',firstName:'Enfant',lastName:'Martin'}];
(async()=>{
  let callbacks=0;let server,browser,nuxt;const log=fs.openSync('/tmp/member-google-nuxt.log','w');
  const temporary=fs.mkdtempSync('/tmp/member-google-nuxt-');
  const project=path.join(temporary,'frontend');
  try {
    fs.mkdirSync(project);
    for(const name of ['app','server','shared'])fs.cpSync(name,path.join(project,name),{recursive:true});
    fs.cpSync('../content',path.join(temporary,'content'),{recursive:true});
    for(const name of ['public','node_modules'])fs.symlinkSync(path.resolve(name),path.join(project,name),'dir');
    for(const name of ['nuxt.config.ts','package.json'])fs.copyFileSync(name,path.join(project,name));
    server=createServer(async(req,res)=>{
      if(req.url.startsWith('/google-simulated?')){res.writeHead(200,{'Content-Type':'text/html'});res.end('<p>Google simulé</p>');return;}
      const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=JSON.parse(Buffer.concat(chunks).toString()||'{}');
      const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(data));};
      if(req.url==='/api/auth/google/config')return send(200,{enabled:true});
      if(req.url==='/api/auth/google/start') {
        const url=new URL(cmsOrigin+'/google-simulated');url.search=new URLSearchParams({...body,code_challenge:body.codeChallenge,scope:'openid email profile'}).toString();return send(200,{url:url.href});
      }
      if(req.url==='/api/auth/google/callback'){callbacks++;return send(200,body.code==='link'?{requiresLink:true,pendingToken}:{jwt:'google-basic-test-session'});}
      if(req.url==='/api/auth/google/pending')return send(body.pendingToken===pendingToken?200:400,{email:profile.email,accounts});
      if(req.url==='/api/auth/google/link')return body.pendingToken===pendingToken&&body.accountId===2&&body.password===password?send(200,{jwt:'google-contributor-test-session'}):send(400,{error:{message:'Mot de passe invalide.'}});
      if(req.url==='/api/member/me')return send(200,req.headers.authorization==='Bearer google-contributor-test-session'?{...profile,id:2,username:accounts[0].username,role:'contributor',hasPassword:true}:profile);
      if(req.url==='/api/site-content')return send(200,{club:{name:'Vertical Côtière'},pages:[],activities:[],albums:[],publications:[]});
      return send(404,{error:{message:'Fixture route not found'}});
    });
    await new Promise(resolve=>server.listen(1358,'127.0.0.1',resolve));
    nuxt=spawn(process.execPath,[path.resolve('node_modules/nuxt/bin/nuxt.mjs'),'dev','--host','127.0.0.1','--port','3108'],{cwd:project,env:{...process.env,NUXT_CMS_URL:cmsOrigin},stdio:['ignore',log,log]});
    let ready=false;for(let i=0;i<100;i++){if(nuxt.exitCode!==null)break;try{ready=(await fetch(origin+'/api/member/google/config')).ok;if(ready)break;}catch{}await new Promise(resolve=>setTimeout(resolve,300));}
    if(!ready)throw Error('Nuxt failed to start; see /tmp/member-google-nuxt.log');
    browser=await chromium.launch({args:['--no-sandbox']});const page=await browser.newPage();const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
    async function start() {
      await page.goto(origin+'/connexion');await page.getByRole('link',{name:'Continuer avec Google',exact:true}).click();
      await expect(page).toHaveURL(/^http:\/\/127.0.0.1:1358\/google-simulated\?/);
      const url=new URL(page.url());expect(url.href).toContain('code_challenge=');expect(url.searchParams.get('code_challenge')).toMatch(/^[\w-]{43}$/);
      const cookie=(await page.context().cookies(origin)).find(cookie=>cookie.name==='vc_google_flow');expect(cookie.httpOnly).toBe(true);expect(cookie.sameSite).toBe('Lax');
      return url.searchParams.get('state');
    }
    await page.goto(origin+'/creer-un-compte');await expect(page.getByRole('link',{name:'Continuer avec Google',exact:true})).toBeVisible();
    await start();await page.goto(origin+'/api/member/google/callback?state='+('x'.repeat(43))+'&code=new');
    await expect(page.getByRole('alert')).toContainText('expiré');expect(callbacks).toBe(0);
    let state=await start();await page.goto(origin+'/api/member/google/callback?state='+state+'&code=new');
    await expect(page).toHaveURL(origin+'/compte');await expect(page.getByRole('heading',{name:'Connexion Google',exact:true})).toBeVisible();
    await expect(page.getByRole('link',{name:'Mes publications',exact:true})).toHaveCount(0);await expect(page.getByRole('heading',{name:'Changer mon mot de passe',exact:true})).toHaveCount(0);
    const session=(await page.context().cookies()).find(cookie=>cookie.name==='vc_member_session');expect(session.httpOnly).toBe(true);expect(session.sameSite).toBe('Lax');expect(await page.evaluate(()=>document.cookie.includes('vc_member_session'))).toBe(false);
    await page.getByRole('button',{name:'Se déconnecter',exact:true}).click();
    state=await start();await page.goto(origin+'/api/member/google/callback?state='+state+'&code=link');
    await expect(page).toHaveURL(/google=lier/);await expect(page.getByRole('group',{name:'Choisissez votre compte',exact:true})).toBeVisible();
    expect((await page.context().cookies()).some(cookie=>cookie.name==='vc_member_session')).toBe(false);
    const pending=(await page.context().cookies()).find(cookie=>cookie.name==='vc_google_pending');expect(pending.httpOnly).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.outerHTML.includes('pending-google-test-token'))).toBe(false);
    const rejected=await page.request.post(origin+'/api/member/google/link',{headers:{Origin:'https://evil.invalid'},data:{accountId:2,password}});expect(rejected.status()).toBe(403);
    await page.getByRole('radio',{name:'Parent Martin parent.martin',exact:true}).check();await page.getByLabel('Mot de passe',{exact:true}).fill('wrong');
    await page.getByRole('button',{name:'Associer Google et me connecter',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Mot de passe invalide');
    await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'/tmp/member-google-link-mobile.png',fullPage:true});
    await page.getByLabel('Mot de passe',{exact:true}).fill(password);await page.getByRole('button',{name:'Associer Google et me connecter',exact:true}).click();
    await expect(page).toHaveURL(origin+'/compte');await expect(page.getByRole('link',{name:'Mes publications',exact:true})).toBeVisible();
    expect((await page.context().cookies()).some(cookie=>cookie.name==='vc_google_pending')).toBe(false);
    expect(pageErrors).toEqual([]);
    console.log('OK navigateur Google : boutons, state, PKCE, session HttpOnly, profil basique, choix familial, liaison explicite, erreur mot de passe, CSRF, rôle conservé, secrets absents du DOM et mobile.');
  }finally {
    if(browser)await browser.close();
    if(nuxt&&nuxt.exitCode===null){const exited=new Promise(resolve=>nuxt.once('exit',resolve));nuxt.kill('SIGTERM');await exited;}
    if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
    fs.closeSync(log);
    fs.rmSync(temporary,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
