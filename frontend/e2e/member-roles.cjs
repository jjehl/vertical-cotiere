// Run against the disposable member database with MEMBER_ROLE_UI_FIXTURE enabled.
const { chromium, expect } = require('@playwright/test');
const fs = require('node:fs');

(async () => {
  const fixture = JSON.parse(fs.readFileSync(0, 'utf8'));
  const origin = process.env.MEMBER_ROLE_CMS_URL || 'http://cms:1347';
  const listPath = '/admin/content-manager/collection-types/plugin::users-permissions.user';
  const browser = await chromium.launch({ args: ['--no-sandbox', '--unsafely-treat-insecure-origin-as-secure=' + origin] });
  try {
    async function login(email) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
      // This isolated production build is served over HTTP inside Docker.
      // Proxy through Playwright's request client for Chromium's local-network restrictions.
      await context.route(origin + '/**', async route => {
        const response = await route.fetch();
        const headers = response.headers();
        if (headers['content-security-policy']) headers['content-security-policy'] = headers['content-security-policy'].replace('upgrade-insecure-requests;', '');
        await route.fulfill({ response, headers });
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(origin + '/admin/auth/login');
      await page.locator('input[name="email"]').fill(email);
      await page.locator('input[name="password"]').fill(fixture.password);
      await page.locator('button[type="submit"]').click();
      await expect(page).not.toHaveURL(/auth\/login/);
      await page.goto(origin + listPath);
      await expect(page.getByRole('row').filter({ hasText: fixture.memberName.split(' ')[0] })).toBeVisible();
      return { context, page, errors };
    }
    const { context, page, errors } = await login(fixture.adminEmail);
    const select = () => page.getByRole('combobox', { name: 'Rôle membre de ' + fixture.memberName, exact: true });
    await expect(select()).toContainText('Utilisateur basique');
    await select().click();
    await expect(page.getByRole('option', { name: 'Contributeur', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Public', exact: true })).toHaveCount(0);
    const saved = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().includes(fixture.documentId));
    await page.getByRole('option', { name: 'Contributeur', exact: true }).click();
    expect((await saved).status()).toBe(200);
    await expect(select()).toContainText('Contributeur');
    await expect(page).toHaveURL(origin + listPath);
    await page.reload();
    await expect(select()).toContainText('Contributeur');

    // A failed request must preserve the saved role and allow a retry.
    let fail = true;
    await page.route('**/content-manager/collection-types/plugin::users-permissions.user/' + fixture.documentId, async route => {
      if (fail && route.request().method() === 'PUT') {
        fail = false;
        await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: { status: 403, name: 'ForbiddenError', message: 'Changement de rôle refusé pour la recette.' } }) });
      } else await route.fallback();
    });
    await select().click();
    await page.getByRole('option', { name: 'Utilisateur basique', exact: true }).click();
    await expect(page.getByText('Changement de rôle refusé pour la recette.', { exact: true })).toBeVisible();
    await expect(select()).toContainText('Contributeur');
    await expect(select()).toBeEnabled();
    await select().click();
    await page.getByRole('option', { name: 'Utilisateur basique', exact: true }).click();
    await expect(select()).toContainText('Utilisateur basique');
    await page.reload();
    await expect(select()).toContainText('Utilisateur basique');
    await page.screenshot({ path: '/tmp/member-role-list.png', fullPage: true });
    expect(errors).toEqual([]);
    await context.close();

    for (const email of [fixture.readerEmail, fixture.profileEditorEmail]) {
      const session = await login(email);
      await expect(session.page.getByRole('combobox', { name: 'Rôle membre de ' + fixture.memberName, exact: true })).toHaveCount(0);
      await expect(session.page.getByRole('row').filter({ hasText: fixture.memberName.split(' ')[0] })).toContainText('Utilisateur basique');
      expect(session.errors).toEqual([]);
      await session.context.close();
    }
    const editor = await login(fixture.roleEditorEmail);
    await expect(editor.page.getByRole('combobox', { name: 'Rôle membre de ' + fixture.memberName, exact: true })).toBeEnabled();
    expect(editor.errors).toEqual([]);
    await editor.context.close();
    console.log('OK : changement de rôle dans la liste, persistance après rechargement, erreur et nouvelle tentative, lecture seule et droits par champ.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
