// Public page and browser-only simulated member/payment flow; no real account, mail or payment.
const {chromium,expect}=require('@playwright/test');
(async()=>{
  const origin=process.env.BASE_URL||'http://127.0.0.1:3000';
  const browser=await chromium.launch({args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
    const catalog=await(await page.request.get(origin+'/api/registrations')).json();expect(catalog.sessions.length).toBeGreaterThan(0);
    expect(catalog.sessions[0].prices).toEqual({STANDARD:16000,CCMP1OU2:15000,FAM:14000,CCMP3:13000});
    await page.goto(origin+'/inscriptions');await page.waitForFunction(()=>!!document.querySelector('#__nuxt')?.__vue_app__);
    await expect(page.locator('.training-session')).toHaveCount(catalog.sessions.length);
    await page.locator('.training-session').first().click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Choisir ce créneau',exact:true}).click();
    await expect(page.getByRole('heading',{name:'Un compte validé pour s’inscrire'})).toBeVisible();await expect(page.locator('.registration-form')).toHaveCount(0);
    await expect(page.getByRole('link',{name:'Se connecter',exact:true})).toHaveAttribute('href',/\/connexion\?retour=.*inscriptions/);
    expect((await page.request.post(origin+'/api/registrations/status',{headers:{Origin:'https://intrusion.invalid'},data:{}})).status()).toBe(403);
    expect((await page.request.post(origin+'/api/registrations/checkout',{headers:{Origin:origin},data:{}})).status()).toBe(401);
    expect((await page.request.post(origin+'/api/registrations/status',{headers:{Origin:origin},data:{}})).status()).toBe(401);
    let member={id:123,username:'marie.payeur',firstName:'Marie',lastName:'Payeur',email:'marie@local.invalid',emailConfirmed:false,phone:'',street:'1 rue du Gymnase',postalCode:'01700',city:'Beynost',country:'France',ffmeLicenseNumber:'',role:'basic'};
    let submitted,fail=true,confirmed=false;
    await page.route('**/api/member/profile',route=>route.fulfill({json:member}));
    await page.route('**/api/registrations',route=>route.fulfill({json:{...catalog,open:true,paymentReady:true,sessions:catalog.sessions.map((slot,i)=>({...slot,remaining:i===1?0:slot.capacity,registrationEnabled:true}))}}));
    const registration=()=>({reference:'browser-test-reference',status:'confirmed',firstName:'Camille',lastName:'Martin',email:'camille@local.invalid',slotLabel:'Cours de recette',amountCents:13000,checkoutUrl:null,accountCreated:true,accountPending:false,invitationPending:false});
    await page.route('**/api/registrations/status',route=>route.fulfill({json:{registrations:confirmed?[registration()]:[]}}));
    await page.route('**/api/registrations/checkout',route=>{
      submitted=route.request().postDataJSON();
      if(fail)return route.fulfill({status:409,json:{data:{message:'Ce créneau est complet. Choisissez un autre horaire.'}}});
      confirmed=true;return route.fulfill({json:registration()});
    });
    const navigate=async()=>{await page.goto(origin+'/contact');await page.waitForFunction(()=>!!document.querySelector('#__nuxt')?.__vue_app__);await page.locator('a[href="/inscriptions"]').first().click();};
    await navigate();await expect(page.getByRole('heading',{name:'Un compte validé pour s’inscrire'})).toBeVisible();await expect(page.locator('.registration-form')).toHaveCount(0);
    member={...member,emailConfirmed:true};await navigate();
    await expect(page.getByRole('region',{name:'Le payeur',exact:true})).toContainText('Marie Payeur · marie@local.invalid');
    await expect(page.getByLabel('E-mail de l’adhérent',{exact:true})).toHaveValue(member.email);await expect(page.getByLabel('E-mail de l’adhérent',{exact:true})).toHaveAttribute('readonly','');
    await page.getByLabel('Votre créneau',{exact:true}).selectOption(catalog.sessions[0].code);
    await page.getByRole('radio',{name:'Une autre personne',exact:true}).check();await expect(page.getByLabel('E-mail de l’adhérent',{exact:true})).toHaveValue('');
    await page.getByRole('radio',{name:/Famille CCMP/}).check();await page.getByLabel('Les deux premiers adhérents de votre famille').fill('Zoé Martin et Louis Martin');
    const child=page.getByRole('group',{name:'L’adhérent',exact:true});await child.getByLabel('Prénom',{exact:true}).fill('Camille');await child.getByLabel('Nom',{exact:true}).fill('Martin');await child.getByLabel('Date de naissance',{exact:true}).fill('2017-02-12');
    await page.getByLabel('E-mail de l’adhérent',{exact:true}).fill('camille@local.invalid');await page.getByLabel('Adresse complète de l’adhérent',{exact:true}).fill('1 rue du Gymnase, 01700 Beynost');await page.getByRole('checkbox').check();
    await expect(page.locator('.registration-total')).toContainText('130,00');
    await page.getByRole('button',{name:'Continuer vers le paiement',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Ce créneau est complet');
    expect(submitted.participantMode).toBe('other');expect(submitted.email).toBe('camille@local.invalid');expect(submitted.promoCode).toBe('CCMP3');
    for(const field of ['payer','payerEmail','payerFirstName','amountCents','sessionToken'])expect(submitted[field]).toBeUndefined();
    fail=false;await page.getByRole('button',{name:'Continuer vers le paiement',exact:true}).click();await expect(page.getByText('Inscription confirmée',{exact:true})).toBeVisible();await expect(page.getByText(/Son lien d’activation a été envoyé à camille@local.invalid/)).toBeVisible();
    await page.getByRole('button',{name:'Inscrire une autre personne',exact:true}).click();await expect(child.getByLabel('Prénom',{exact:true})).toHaveValue('');await expect(page.getByLabel('E-mail de l’adhérent',{exact:true})).toHaveValue('');await expect(page.getByRole('region',{name:'Le payeur',exact:true})).toContainText(member.email);
    await page.screenshot({path:'/tmp/registrations-members-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'/tmp/registrations-members-mobile.png',fullPage:true});
    await page.route('**/api/registrations/activate',route=>route.fulfill({json:{ok:true}}));await page.goto(origin+'/activer-mon-compte?code='+'a'.repeat(64));
    await page.getByLabel('Mot de passe',{exact:true}).fill('Activation-test-123456');await page.getByLabel('Confirmer le mot de passe',{exact:true}).fill('Activation-test-123456');await page.getByRole('button',{name:'Valider mon e-mail et activer mon compte',exact:true}).click();await expect(page.getByRole('heading',{name:'Votre compte est activé',exact:true})).toBeVisible();
    expect(errors).toEqual([]);
    console.log('OK : accès visiteur et e-mail non validé refusés, connexion avec retour, tarif local, payeur fixe, choix soi/autre, e-mail par adhérent, inscription suivante, activation et mobile sans débordement.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
