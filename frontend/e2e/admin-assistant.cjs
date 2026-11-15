// Optional browser recipe: reads credentials for the disposable test database
// from stdin. All admin API requests are forwarded to that isolated instance.
const {chromium,expect}=require('@playwright/test');
const fs=require('node:fs');
(async()=>{
  const fixture=JSON.parse(fs.readFileSync(0,'utf8'));
  const browser=await chromium.launch({args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:1600,height:1100}});
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    const init=await (await page.request.get('http://cms:1347/admin/init')).json();
    await page.addInitScript(({uuid})=>{
      const key='STRAPI_LIST_VIEW_DISPLAYED_HEADERS:api::publication.publication';
      const scoped=key+':'+uuid;
      if(!localStorage.getItem(scoped))localStorage.setItem(scoped,JSON.stringify(['title','date','category']));
    },{uuid:init.data.uuid});
    await page.route('**/*',async route=>{
      const request=route.request();
      const url=new URL(request.url());
      if(['fetch','xhr'].includes(request.resourceType())&&['cms','localhost','127.0.0.1'].includes(url.hostname)) {
        url.hostname='cms';url.port='1347';url.protocol='http:';
        const response=await route.fetch({url:url.toString()});
        await route.fulfill({response,headers:{...response.headers(),'access-control-allow-origin':'http://cms:1337','access-control-allow-credentials':'true'}});
      }else await route.continue();
    });
    await page.goto('http://cms:1337/admin/auth/login');
    await page.locator('input[name="email"]').fill(fixture.email);
    await page.locator('input[name="password"]').fill(fixture.password);
    await page.getByRole('button',{name:/login|log in|se connecter/i}).click();
    await expect(page).not.toHaveURL(/auth\/login/);
    const list='http://cms:1337/admin/content-manager/collection-types/api::publication.publication';
    await page.goto(list);
    await expect(page.getByRole('gridcell',{name:'Date de l’événement',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Skip',exact:true}).click({timeout:2000}).catch(()=>{});
    await page.getByRole('gridcell',{name:'Date de l’événement',exact:true}).click();
    await expect(page).toHaveURL(/eventDate/);
    await page.goto(list+'/'+fixture.documentId);
    await page.getByRole('button',{name:'Modifier avec l’assistant IA',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Modifier avec l’assistant IA'})).toBeVisible();
    await page.getByLabel('Que souhaitez-vous modifier ?').fill('TEST_EDIT reporte la sortie et ajoute le casque.');
    await page.getByRole('button',{name:'Préparer la proposition'}).click();
    await expect(page.getByRole('heading',{name:'Avant modification'})).toBeVisible();
    await expect(page.getByRole('heading',{name:'Proposition de modification'})).toBeVisible();
    await page.getByRole('button',{name:'Enregistrer le brouillon',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Modification enregistrée en brouillon'})).toBeVisible();
    expect(errors).toEqual([]);
    console.log('Navigateur : colonne visible et triable, bouton IA, aperçu avant/après et modification en brouillon validés.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
