import { test, expect } from '@playwright/test'

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

test('horaires intégrés et calendrier UFRAPS sans renvoi vers l’ancien site', async ({ page }) => {
  await page.goto('/horaires/')
  await expect(page).toHaveURL(/\/horaires-et-acces#horaires$/)
  await expect(page.getByRole('table', { name:'Horaires des cours 2026–2027' }).locator('tbody tr')).toHaveCount(23)
  await page.getByText('Voir tous les samedis d’ouverture de la saison', {exact:true}).click()
  await expect(page.locator('details').filter({hasText:'Voir tous les samedis'}).locator('.opening-dates')).toContainText('samedi 12 juin 2027')
  await expect(page.locator('details').filter({hasText:'Voir tous les samedis'}).locator('.opening-dates')).not.toContainText('samedi 1 mai 2027')
  await expect(page.locator('details').filter({hasText:'Voir tous les samedis'}).locator('.opening-dates')).not.toContainText('samedi 8 mai 2027')
  const old = await page.locator('a[href]').evaluateAll(links => links.map(link => (link as HTMLAnchorElement).href).filter(href => ['vertical-cotiere.fr','www.vertical-cotiere.fr'].includes(new URL(href).hostname)))
  expect(old).toEqual([])
})

test('calendrier importé, stage sur plusieurs jours et export ICS', async ({ page, request }) => {
  const data = await (await request.get('/api/content')).json()
  expect(data.events).toHaveLength(30)
  expect(data.pages).toHaveLength(38)
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
  const photo=page.locator('.activity-card[href="/activites/cours-escalade"] img');
  await expect(photo).toHaveAttribute('src',course.image);
  await expect(photo).toHaveCSS('object-position','100% 45%');
  expect(await photo.evaluate((img:HTMLImageElement)=>img.complete&&img.naturalWidth>0)).toBeTruthy();
});


test('un fil commun pour les informations, rendez-vous et photos',async({page,request})=>{
  const data=await(await request.get('/api/content')).json();
  await page.goto('/vie-du-club');
  await expect(page.getByRole('heading',{name:'La vie du club.'})).toBeVisible();
  await expect(page.locator('.publication-card')).toHaveCount(24);
  const album=data.publications.find((p:{slug:string})=>p.slug==='61-2025-05-08-au-11-buis-les-baronnies');
  await page.getByRole('searchbox',{name:'Rechercher une publication'}).fill('Buis les Baronnies');
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
