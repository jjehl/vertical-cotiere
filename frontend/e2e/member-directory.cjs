// Run with the disposable MEMBER_UI_FIXTURE from cms/tests/members.integration.js on stdin.
const {chromium,expect}=require('@playwright/test');
const fs=require('node:fs');
(async()=>{
  const fixture=JSON.parse(fs.readFileSync(0,'utf8'));
  const origin='http://127.0.0.1:3107';
  const browser=await chromium.launch({args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/membres');await expect(page).toHaveURL(/\/connexion$/);
    const login=async(email,password)=>{
      await page.getByLabel('Identifiant ou adresse e-mail',{exact:true}).fill(email);
      await page.getByLabel('Mot de passe',{exact:true}).fill(password);
      await page.getByRole('button',{name:'Se connecter',exact:true}).click();
      await expect(page).toHaveURL(/\/compte$/);
    };
    await login(fixture.directoryAdmin.email,fixture.directoryAdmin.password);
    await expect(page.getByRole('link',{name:'Mes publications',exact:true})).toBeVisible();
    await page.getByRole('link',{name:'Liste des membres',exact:true}).click();
    await expect(page.getByRole('table')).toBeVisible();
    expect((await page.request.get(origin+'/membres')).headers()['cache-control']).toContain('no-store');
    await page.getByLabel('Rechercher un membre').fill('Annuaire');
    await page.getByRole('button',{name:'Rechercher',exact:true}).click();
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(3);
    await page.getByRole('button',{name:'Nom',exact:true}).click();
    await expect(page.getByRole('table').locator('tbody tr').first()).toContainText('Annuaire Zulu');
    await page.getByRole('button',{name:'Nom',exact:true}).click();
    await expect(page.getByRole('table').locator('tbody tr').first()).toContainText('Admin');
    await page.getByLabel('État du compte').selectOption('blocked');
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
    await page.getByLabel('État du compte').selectOption('active');
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(2);
    await page.getByRole('combobox',{name:'Rôle',exact:true}).selectOption('basic');
    await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(1);
    const response=await page.request.get(origin+'/api/member/directory?q=Annuaire&pageSize=1&page=2');
    expect(response.status()).toBe(200);expect(response.headers()['cache-control']).toContain('no-store');
    expect((await response.json()).pagination).toMatchObject({page:2,pageSize:1,total:3});
    await page.screenshot({path:'/tmp/member-directory-desktop.png',fullPage:true});
    await page.getByRole('link',{name:fixture.directoryAdmin.childName,exact:true}).click();
    await expect(page.getByRole('heading',{name:'Coordonnées et identité'})).toBeVisible();
    await expect(page.getByText('000987',{exact:true})).toBeVisible();
    await expect(page.getByText('Paiement confirmé',{exact:true})).toBeVisible();
    await expect(page.getByText('180,00 €',{exact:true})).toBeVisible();
    await page.getByText('Détails du dossier et du paiement',{exact:true}).click();
    await expect(page.getByText('directory-checkout',{exact:true})).toBeVisible();
    await page.reload();await expect(page.getByText('000987',{exact:true})).toBeVisible();
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'/tmp/member-directory-detail-mobile.png',fullPage:true});
    // Navigating to another member must replace the entire fiche, including its data key.
    const payerSection=page.locator('.directory-section').first();
    await payerSection.getByRole('link',{name:'Admin Annuaire',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Admin Annuaire.'})).toBeVisible();
    await expect(page.getByText('000987',{exact:true})).toHaveCount(0);
    await expect(page.getByRole('heading',{name:'Dossiers de paiement pour d’autres adhérents (1)'})).toBeVisible();
    await page.goto(origin+'/membres');await expect(page.getByRole('table')).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'/tmp/member-directory-mobile.png',fullPage:true});
    await page.goto(origin+'/compte');await page.getByRole('button',{name:'Se déconnecter'}).click();
    await login(fixture.sharedEmail.username,fixture.sharedEmail.password);
    await expect(page.getByRole('link',{name:'Liste des membres',exact:true})).toHaveCount(0);
    await page.goto(origin+'/membres/'+fixture.directoryAdmin.childId);await expect(page).toHaveURL(/\/compte$/);
    expect((await page.request.get(origin+'/api/member/directory')).status()).toBe(403);
    expect((await page.request.get(origin+'/api/member/directory/'+fixture.directoryAdmin.childId)).status()).toBe(403);
    expect(errors).toEqual([]);
    console.log('OK navigateur : accès admin, recherche, tris, filtres, pagination API, fiches cours/paiements, navigation entre membres, mobile et refus des autres profils.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
