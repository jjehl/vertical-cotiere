import { test, expect } from '@playwright/test'

test('la compétition présente un article générique et des rendez-vous filtrés',async({page,request})=>{
  await page.goto('/activites/competition');
  await expect(page.locator('.resource-links a')).toHaveCount(2);
  await page.getByRole('link',{name:'Les rendez-vous',exact:true}).click();
  expect(new URL(page.url()).searchParams.get('categorie')).toBe('Compétition');
  await expect(page.getByRole('button',{name:'Compétition',exact:true})).toHaveAttribute('aria-pressed','true');
  await page.goto('/ressources/coupe-de-lain');
  await expect(page.getByRole('heading',{name:'La compétition au club',exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'La Coupe de l’Ain, au cœur de notre engagement'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Calendrier officiel national des compétitions — FFME MyCompet'})).toHaveAttribute('href','https://mycompet.ffme.fr/app');
  await expect(page.locator('article')).not.toContainText(/\b20\d{2}\b|€|U\d+/);
  await expect(page.locator('article a[href*="/imports/"], article a[href*=".pdf"]')).toHaveCount(0);
  await page.getByRole('link',{name:'Les rendez-vous compétition du club'}).click();
  expect(new URL(page.url()).searchParams.get('categorie')).toBe('Compétition');
  for(const slug of ['competition','autres-competitions','option-competition']) {
    const response=await request.get('/ressources/'+slug,{maxRedirects:0});
    expect(response.status()).toBe(301);
    expect(response.headers().location).toBe('/ressources/coupe-de-lain');
  }
  await page.goto('/ressources/equipe-departementale');
  await expect(page.getByRole('link',{name:'Découvrir l’équipe départementale sur le site FFME 01'})).toHaveAttribute('href','https://ffme01.fr/equipes-escalade/');
  await expect(page.locator('article')).not.toContainText(/\b20\d{2}\b|€|U\d+/);
  const content=await(await request.get('/api/content')).json();
  expect(content.pages.filter((p:{group:string})=>p.group==='Compétitions').map((p:{slug:string})=>p.slug).sort()).toEqual(['coupe-de-lain','equipe-departementale']);
});

test('contenus du CMS, navigation et recherche agenda', async ({ page, request }) => {
  const content = await request.get('/api/content')
  expect(content.ok()).toBeTruthy()
  expect((await content.json()).activities).toHaveLength(3)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Plus haut. Ensemble.' })).toBeVisible()
  await page.locator('.activity-card').filter({ hasText: 'Compétition' }).click()
  await expect(page.getByRole('heading', { name: 'Le goût du défi.' })).toBeVisible()
  await page.goto('/agenda')
  await page.getByRole('button', { name: 'Compétition', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Aucun rendez-vous')
  await page.getByRole('button', { name: 'Tous', exact: true }).click()
  await page.getByRole('button', { name: 'Mois', exact: true }).click()
  await expect(page.getByLabel('Calendrier mensuel')).toBeVisible()
  await page.goto('/inscriptions')
  await expect(page.getByRole('link', { name: 'S’inscrire sur HelloAsso' })).toHaveAttribute('href', /helloasso.com/)
})

test('navigation mobile, absence de débordement et liens de pied de page', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Menu', exact: true }).click()
  await page.getByRole('navigation').getByRole('link', { name: 'Le club', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'L’esprit Vertical Côtière.' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
  await page.goto('/contact')
  await expect(page.getByRole('link', { name: /secretariat@vertical-cotiere.fr/ }).first()).toHaveAttribute('href', 'mailto:secretariat@vertical-cotiere.fr')
})

test('un contenu inconnu répond en 404', async ({ request }) => {
  expect((await request.get('/actualites/article-inconnu')).status()).toBe(404)
})

test('cours et horaires réunis, semaine compacte et calendrier UFRAPS', async ({ page, request }) => {
  await page.goto('/horaires/')
  await expect(page).toHaveURL(/\/horaires-et-acces#horaires$/)
  const content=await(await request.get('/api/content')).json();
  const course=content.activities.find((activity:{slug:string})=>activity.slug==='cours-escalade');
  const photo=page.locator('.course-heading__photo');
  await expect(photo).toHaveAttribute('src',course.image);
  await expect(photo).toHaveCSS('object-position',course.imagePosition);
  const photoPosition=await photo.boundingBox();
  const titlePosition=await page.locator('.course-heading h1').boundingBox();
  expect(photoPosition!.x).toBeGreaterThan(titlePosition!.x+titlePosition!.width);
  expect(photoPosition!.width).toBeLessThanOrEqual(300);
  expect(photoPosition!.height).toBeLessThanOrEqual(220);
  const week=page.getByRole('region',{name:'Semaine type des cours 2026–2027'})
  await expect(week.getByRole('button',{name:/Voir les détails/})).toHaveCount(23)
  const monday=week.getByRole('button',{name:'Lundi, 17:30 à 19:00, CE2 à CM2. Voir les détails'})
  await monday.click()
  const slot=page.getByRole('dialog',{name:'CE2 à CM2'})
  await expect(slot).toBeVisible()
  await expect(slot).toContainText('2016–2018')
  await expect(slot).toContainText('Séance encadrée')
  await slot.click({position:{x:8,y:8}})
  await expect(slot).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(slot).not.toBeVisible()
  await expect(monday).toBeFocused()
  const days=week.locator('.training-week__day')
  const mondayPosition=await days.nth(0).boundingBox()
  const tuesdayPosition=await days.nth(1).boundingBox()
  expect(tuesdayPosition!.x).toBeGreaterThan(mondayPosition!.x)
  expect(tuesdayPosition!.y).toBe(mondayPosition!.y)
  await expect(page.getByText('Consulter tous les détails en tableau',{exact:true})).toHaveCount(0)
  expect((await week.locator('.training-week__grid').boundingBox())!.height).toBeLessThan(700)
  const tuesday=week.getByRole('button',{name:'Mardi, 17:30 à 19:00, Collège. Voir les détails'});
  expect((await tuesday.boundingBox())!.y).toBeCloseTo((await monday.boundingBox())!.y,0);
  const monday19=week.getByRole('button',{name:'Lundi, 19:00 à 21:00, Collège. Voir les détails'});
  const tuesday19=week.getByRole('button',{name:'Mardi, 19:00 à 21:00, Groupe compétition. Voir les détails'});
  expect((await monday19.boundingBox())!.y).toBeCloseTo((await tuesday19.boundingBox())!.y,0);
  const saturday=week.getByRole('button',{name:'Samedi, 09:00 à 10:00, CP à CE1. Voir les détails'});
  expect((await saturday.boundingBox())!.y).toBeLessThan((await monday.boundingBox())!.y);
  await page.getByText('Voir tous les samedis d’ouverture de la saison', {exact:true}).click()
  await expect(page.locator('details').filter({hasText:'Voir tous les samedis'}).locator('.opening-dates')).toContainText('samedi 12 juin 2027')
  await expect(page.locator('details').filter({hasText:'Voir tous les samedis'}).locator('.opening-dates')).not.toContainText('samedi 1 mai 2027')
  await expect(page.locator('details').filter({hasText:'Voir tous les samedis'}).locator('.opening-dates')).not.toContainText('samedi 8 mai 2027')
  const old = await page.locator('a[href]').evaluateAll(links => links.map(link => (link as HTMLAnchorElement).href).filter(href => ['vertical-cotiere.fr','www.vertical-cotiere.fr'].includes(new URL(href).hostname)))
  expect(old).toEqual([])
  await page.setViewportSize({width:390,height:844})
  const mondayMobile=await days.nth(0).boundingBox()
  const tuesdayMobile=await days.nth(1).boundingBox()
  expect(tuesdayMobile!.y).toBe(mondayMobile!.y)
  expect(tuesdayMobile!.x).toBeGreaterThan(mondayMobile!.x)
  const scroll=week.locator('.training-week__scroll');
  expect(await scroll.evaluate(element=>element.scrollWidth>element.clientWidth)).toBeTruthy();
  await scroll.evaluate(element=>{element.scrollLeft=element.scrollWidth;});
  expect(Math.abs((await week.locator('.training-week__scale').boundingBox())!.x-(await scroll.boundingBox())!.x)).toBeLessThanOrEqual(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy()
  await week.getByRole('button',{name:'Lundi, 21:00 à 22:30, Adultes. Voir les détails'}).click()
  await expect(page.getByRole('dialog',{name:'Adultes'})).toContainText('Pratique autonome, non encadrée')
  await page.getByRole('button',{name:'Fermer le créneau'}).click()
  const response=await request.get('/activites/cours-escalade',{maxRedirects:0});
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe('/horaires-et-acces');
  await page.goto('/activites/cours-escalade');
  await expect(page).toHaveURL(/\/horaires-et-acces$/);
  await expect(page.getByRole('heading',{name:'Des premières prises à l’autonomie.'})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Deux lieux pour grimper.'})).toBeVisible();
  await expect(page.locator('#cours')).toContainText('baby escalade');
  await page.getByRole('link',{name:'Les stages à venir',exact:true}).click();
  await expect(page).toHaveURL(/\/agenda\?categorie=Stage/);
  expect(new URL(page.url()).searchParams.get('categorie')).toBe('Stage');
  const retired=await request.get('/ressources/stages',{maxRedirects:0});
  expect(retired.status()).toBe(301);
  expect(retired.headers().location).toBe('/agenda?categorie=Stage');
  const data=await(await request.get('/api/content')).json();
  expect(data.pages.some((p:{slug:string})=>p.slug==='stages')).toBe(false);
})

test('calendrier importé, stage sur plusieurs jours et export ICS', async ({ page, request }) => {
  const data = await (await request.get('/api/content')).json()
  expect(data.events).toHaveLength(30)
  expect(data.pages).toHaveLength(34)
  expect(data.publications).toHaveLength(116)
  await page.goto('/agenda?mois=2026-10&vue=mois')
  const stage = data.events.find((e: {slug:string}) => e.slug === 'stage-vacances-dautomne-adherents-vertical-cotiere')
  await expect(page.getByLabel('Calendrier mensuel').getByRole('link', {name:new RegExp(stage.title)})).toHaveCount(2)
  await page.getByRole('button', {name:'Jour',exact:true}).click()
  await page.getByLabel('Choisir un jour').fill('2026-10-20')
  await expect(page.locator('.event-row')).toHaveCount(1)
  await expect(page.locator('.event-row')).toContainText(stage.title)
  const exported=await request.get('/api/agenda.ics?mois=2026-10')
  expect(exported.headers()['content-type']).toContain('text/calendar')
  const ics=await exported.text()
  expect(ics).toContain('UID:6510-1792400400-1792512000@www.vertical-cotiere.fr')
  expect(ics).toContain('DTSTART;VALUE=DATE:20261010')
  expect(ics).toContain('DTEND;VALUE=DATE:20261011')
})

test('pages et fichiers importés disponibles localement', async ({ request }) => {
  test.setTimeout(180000)
  const data=await(await request.get('/api/content')).json()
  for(const [kind,items] of [['ressources',data.pages],['vie-du-club',data.publications]] as const) {
    for(const item of items) {
      const response=await request.get(`/${kind}/${item.slug}`)
      expect(response.status(),`${kind}/${item.slug}`).toBe(200)
      expect(await response.text()).not.toMatch(/(?:href|src)="https?:\/\/(?:www\.)?vertical-cotiere\.fr\//)
    }
  }
  const media=new Set<string>();
  for(const item of [...data.pages,...data.events])for(const match of (item.bodyHtml||'').matchAll(/\/media\/(\d+)/g))media.add(match[1]);
  for(const id of media)expect((await request.head('/media/'+id)).status(),'Média intégré '+id).toBe(200);
  const documents=await(await request.get('/api/documents')).json()
  expect(documents).toHaveLength(39)
  const pdf=await request.get(documents.find((d:{format:string})=>d.format==='PDF').url)
  expect(pdf.status()).toBe(200)
  expect((await request.head(documents[0].url)).status()).toBe(200)
  expect((await pdf.body()).subarray(0,4).toString()).toBe('%PDF')
})

test('albums publics, visionneuse et téléchargement local', async ({page,request})=>{
  const albums=await(await request.get('/api/albums')).json()
  expect(albums).toHaveLength(55)
  expect(albums.reduce((n:number,a:{count:number})=>n+a.count,0)).toBe(1105)
  await page.goto(`/albums/${albums[0].slug}`)
  await expect(page).toHaveURL(/\/vie-du-club\//)
  await page.getByRole('button',{name:/Ouvrir la photo 1 :/}).click()
  const dialog=page.getByRole('dialog',{name:'Aperçu de la photo'})
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('link',{name:'Télécharger l’original'})).toHaveAttribute('href',/^\/media\/\d+$/)
  await dialog.getByRole('button',{name:'Suivante →',exact:true}).click()
  await expect(dialog).toContainText('2 /')
  await page.keyboard.press('Escape')
  await expect(dialog).not.toBeVisible()
  const legacy=await request.get('/albums/index.php?/category/61')
  expect(legacy.status()).toBe(200)
})


test('documents du club et nouvelle photo des cours administrés par Strapi',async({page,request})=>{
  const data=await(await request.get('/api/content')).json();
  const presentation=data.pages.find((p:{slug:string})=>p.slug==='presentation');
  expect(presentation.documents).toHaveLength(2);
  await page.goto('/le-club');
  const documents=page.getByRole('region',{name:'Documents de l’association'});
  await expect(documents.getByRole('link',{name:/Règlement intérieur/})).toBeVisible();
  await expect(documents.getByRole('link',{name:/Procès-verbal de l’AG 2025/})).toBeVisible();
  for(const doc of presentation.documents){
    await expect(documents.locator('a[href="'+doc.url+'"]')).toBeVisible();
    const pdf=await request.get(doc.url);
    expect(pdf.ok()).toBeTruthy();
    expect((await pdf.body()).subarray(0,4).toString()).toBe('%PDF');
  }
  const course=data.activities.find((a:{slug:string})=>a.slug==='cours-escalade');
  expect(course.imageAlt).toContain('Grimpeuse');
  expect(course.imagePosition).toBe('100% 45%');
  await page.goto('/');
  const photo=page.locator('.activity-card[href="/horaires-et-acces"] img');
  await expect(photo).toHaveAttribute('src',course.image);
  await expect(photo).toHaveCSS('object-position','100% 45%');
  expect(await photo.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBeTruthy();
});


test('La vie du club affiche seulement les publications avec plusieurs photos',async({page,request})=>{
  const data=await(await request.get('/api/content')).json();
  const albums=data.publications.filter((p:{photoCount:number})=>p.photoCount>1);
  await page.goto('/');
  await expect(page.locator('.news-section .publication-card')).toHaveCount(Math.min(3,albums.length));
  expect(await page.locator('.news-section .publication-card').evaluateAll(cards=>cards.map(card=>card.getAttribute('href')))).toEqual(albums.slice(0,3).map((p:{slug:string})=>'/vie-du-club/'+p.slug));
  await page.goto('/vie-du-club');
  await expect(page.getByRole('heading',{name:'La vie du club.'})).toBeVisible();
  await expect(page.locator('.publication-card')).toHaveCount(Math.min(24,albums.length));
  expect(await page.locator('.publication-card').evaluateAll(cards=>cards.map(card=>card.getAttribute('href')))).toEqual(albums.slice(0,24).map((p:{slug:string})=>'/vie-du-club/'+p.slug));
  if(albums.length>24) {
    await page.getByRole('button',{name:'Voir les albums précédents ↓'}).click();
    await expect(page.locator('.publication-card')).toHaveCount(Math.min(48,albums.length));
    expect(await page.locator('.publication-card').evaluateAll(cards=>cards.map(card=>card.getAttribute('href')))).toEqual(albums.slice(0,48).map((p:{slug:string})=>'/vie-du-club/'+p.slug));
  }
  const withoutAlbum=data.publications.find((p:{title:string;summary:string;photoCount:number})=>p.photoCount<=1&&!albums.some((album:{title:string;summary:string;category:string})=>`${album.title} ${album.summary} ${album.category}`.toLocaleLowerCase('fr').includes(p.title.toLocaleLowerCase('fr'))));
  expect(withoutAlbum).toBeTruthy();
  await page.getByRole('searchbox',{name:'Rechercher un album photo'}).fill(withoutAlbum.title);
  await expect(page.locator('.publication-card')).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText('Aucun album photo');
  const album=data.publications.find((p:{slug:string})=>p.slug==='61-2025-05-08-au-11-buis-les-baronnies');
  await page.getByRole('searchbox',{name:'Rechercher un album photo'}).fill('Buis les Baronnies');
  await expect(page.locator('.publication-card')).toHaveCount(1);
  await page.locator('.publication-card').click();
  await expect(page.getByRole('heading',{name:album.title,exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'Photos de la publication'})).toBeVisible();
  const event=data.events.find((e:{legacySlug:string})=>e.legacySlug==='contest-de-rentree');
  await page.goto('/agenda/contest-de-rentree');
  await expect(page).toHaveURL(new RegExp('/vie-du-club/'+event.slug+'$'));
  await expect(page.locator('.event-aside')).toBeVisible();
  const detail=await(await request.get('/api/publications/'+event.slug)).json();
  expect(detail.meeting.calendarUid).toBe(event.calendarUid);
  await page.goto('/actualites');
  await expect(page).toHaveURL(/\/vie-du-club$/);
  await page.goto('/albums');
  await expect(page).toHaveURL(/\/vie-du-club$/);
});
