import {test,expect,type Page} from '@playwright/test';

async function gallery(page:Page,count=3,canReorder=true){
  const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="600" height="450" fill="#446a55"/></svg>');
  const photos=Array.from({length:count},(_,index)=>({id:index+1,title:`Photo ${index+1}`,src:image,thumb:image,width:600,height:450}));
  let savedIds=photos.map(photo=>photo.id);let fail=false;const requests:number[][]=[];
  const publication=()=>({slug:'photo-order-test',title:'Photos de la sortie',date:null,category:'Sortie',summary:'Test galerie',body:'La sortie du club.',bodyHtml:'',image,photoCount:count,meeting:null,attachments:[],photos:savedIds.map(id=>photos[id-1])});
  await page.route('**/api/member/profile',route=>route.fulfill({json:{id:1,role:'contributor',firstName:'Camille',lastName:'Test',username:'photo.test',email:'photo@local.invalid'}}));
  await page.route('**/api/publications/photo-order-test',route=>route.fulfill({json:publication()}));
  await page.route('**/api/member/publications/photo-order-test/photos',async route=>{
    if(route.request().method()==='GET')return route.fulfill({json:{ids:[],canReorder}});
    const body=route.request().postDataJSON();requests.push(body.ids);
    if(fail)return route.fulfill({status:409,json:{statusMessage:'Les photos ont changé. Rechargez la publication.'}});
    expect(body.previousIds).toEqual(savedIds);savedIds=body.ids;
    return route.fulfill({json:{ids:savedIds}});
  });
  async function open(){
    await page.goto('/connexion');
    await page.waitForFunction(()=>Boolean((document.querySelector('#__nuxt') as Element & {__vue_app__?:unknown})?.__vue_app__));
    await page.evaluate(()=>{
      const root=document.querySelector('#__nuxt') as Element & {__vue_app__:{config:{globalProperties:{$router:{push:(path:string)=>Promise<void>}}}}};
      return root.__vue_app__.config.globalProperties.$router.push('/vie-du-club/photo-order-test');
    });
    await expect(page.getByRole('heading',{name:'Photos de la sortie',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Ajouter des photos',exact:true})).toBeEnabled();
  }
  await open();
  return {open,requests,setFail:(value:boolean)=>{fail=value;},order:()=>page.locator('.photo-grid img').evaluateAll(images=>images.map(image=>image.getAttribute('alt')))};
}

test('déplacer, annuler, enregistrer et retrouver l’ordre des photos',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  const ui=await gallery(page);
  const edit=page.getByRole('button',{name:'Réorganiser les photos',exact:true});
  await edit.click();
  await page.getByRole('button',{name:'Glisser la photo : Photo 1',exact:true}).dragTo(page.locator('.photo-grid figure').nth(2));
  expect(await ui.order()).toEqual(['Photo 2','Photo 3','Photo 1']);
  await page.getByRole('button',{name:'Annuler',exact:true}).click();
  expect(await ui.order()).toEqual(['Photo 1','Photo 2','Photo 3']);expect(ui.requests).toEqual([]);
  await edit.click();
  const first=page.getByRole('button',{name:'Mettre en premier : Photo 3',exact:true});await first.focus();await page.keyboard.press('Enter');
  expect(await ui.order()).toEqual(['Photo 3','Photo 1','Photo 2']);
  await page.getByRole('button',{name:'Enregistrer l’ordre',exact:true}).click();
  await expect(page.getByText('L’ordre des photos a été enregistré.',{exact:true})).toBeVisible();
  expect(ui.requests).toEqual([[3,1,2]]);
  await ui.open();expect(await ui.order()).toEqual(['Photo 3','Photo 1','Photo 2']);
  await edit.click();await page.getByRole('button',{name:'Reculer la photo : Photo 3',exact:true}).click();
  ui.setFail(true);await page.getByRole('button',{name:'Enregistrer l’ordre',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Les photos ont changé');
  await page.getByRole('button',{name:'Annuler',exact:true}).click();expect(await ui.order()).toEqual(['Photo 3','Photo 1','Photo 2']);
  await page.getByRole('button',{name:'Ouvrir la photo 1 : Photo 3',exact:true}).click();
  await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('dialog').getByRole('img')).toHaveAttribute('alt','Photo 3');
  expect(errors).toEqual([]);
});

test('boutons sur mobile et déplacements entre les pages de la galerie',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  const ui=await gallery(page,50);
  await page.getByRole('button',{name:'Réorganiser les photos',exact:true}).click();
  await page.getByRole('button',{name:'Reculer la photo : Photo 48',exact:true}).click();
  expect(await ui.order()).toEqual(['Photo 48','Photo 50']);
  await page.getByRole('button',{name:'Mettre en premier : Photo 48',exact:true}).click();
  expect((await ui.order())[0]).toEqual('Photo 48');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Enregistrer l’ordre',exact:true}).click();
  await expect(page.getByText('L’ordre des photos a été enregistré.',{exact:true})).toBeVisible();
  expect(ui.requests[0]).toHaveLength(50);expect(ui.requests[0]?.[0]).toBe(48);expect(new Set(ui.requests[0]).size).toBe(50);
});

test('la réorganisation reste réservée aux membres autorisés',async({page})=>{
  await gallery(page,3,false);
  await expect(page.getByRole('button',{name:'Réorganiser les photos',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Ouvrir la photo 1 : Photo 1',exact:true})).toBeEnabled();
});
