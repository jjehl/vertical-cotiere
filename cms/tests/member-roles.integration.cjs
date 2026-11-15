const assert = require('node:assert/strict');
const fs = require('node:fs/promises');

module.exports = async function memberRoleTests({ app, request, user, token, basic, contributor, admin, adminToken, password }) {
  const model = 'plugin::users-permissions.user';
  const query = app.db.query(model);
  const original = await query.findOne({ where: { id: user.id }, populate: { role: true } });
  const path = '/content-manager/collection-types/' + model + '/' + original.documentId;
  const rolesPath = '/content-manager/relations/' + model + '/role?pageSize=100&filters[type][$ne]=public';
  const options = await request(rolesPath, null, adminToken);
  assert.equal(options.status, 200, JSON.stringify(options.body));
  assert(options.body.results.some(role => role.id === basic.id));
  assert(options.body.results.some(role => role.id === contributor.id));
  const publicRole = await app.db.query('plugin::users-permissions.role').findOne({ where: { type: 'public' } });
  assert(!options.body.results.some(role => role.id === publicRole.id));
  for (const credential of [undefined, token]) {
    assert([401, 403].includes((await request(rolesPath, null, credential)).status));
    assert([401, 403].includes((await request(path, { role: contributor.id }, credential, 'PUT')).status));
  }

  const saved = await request(path, { role: contributor.id }, adminToken, 'PUT');
  assert.equal(saved.status, 200, JSON.stringify(saved.body));
  assert.equal(saved.body.documentId, original.documentId);
  assert.equal((await query.findOne({ where: { id: user.id }, populate: { role: true } })).role.id, contributor.id);
  assert.equal((await request('/api/member/me', null, token)).body.role, 'contributor');
  const after = await query.findOne({ where: { id: user.id } });
  for (const field of ['username', 'email', 'firstName', 'lastName', 'password', 'confirmed', 'blocked']) assert.equal(after[field], original[field]);
  assert.equal((await request('/api/auth/local', { identifier: user.username, password })).status, 200);
  assert.equal((await request(path, { role: basic.id }, adminToken, 'PUT')).status, 200);
  assert.equal((await request('/api/member/me', null, token)).body.role, 'basic');
  assert.equal((await request('/api/member/publications', null, token)).status, 403);

  async function createAdmin(code, fields) {
    const role = await app.service('admin::role').create({ name: code, code });
    await app.service('admin::role').assignPermissions(role.id, [
      { action: 'plugin::content-manager.explorer.read', subject: model, properties: { fields: ['username', 'firstName', 'lastName', 'email', 'role'] }, conditions: [] },
      ...(fields ? [{ action: 'plugin::content-manager.explorer.update', subject: model, properties: { fields }, conditions: [] }] : []),
    ]);
    const account = await app.service('admin::user').create({ email: code + '@local.invalid', password, firstname: 'Test', lastname: code, isActive: true, roles: [role.id] });
    const login = await request('/admin/login', { email: account.email, password });
    assert.equal(login.status, 200);
    return { email: account.email, token: login.body.data.token };
  }
  const reader = await createAdmin('member-role-reader');
  const profileEditor = await createAdmin('member-profile-editor', ['firstName', 'lastName']);
  const roleEditor = await createAdmin('member-role-editor', ['role']);
  assert.equal((await request(path, { role: contributor.id }, reader.token, 'PUT')).status, 403);
  // Strapi may silently sanitize a forbidden field instead of rejecting the update.
  const deniedField = await request(path, { role: contributor.id }, profileEditor.token, 'PUT');
  assert([200, 403].includes(deniedField.status), JSON.stringify(deniedField.body));
  assert.equal((await query.findOne({ where: { id: user.id }, populate: { role: true } })).role.id, basic.id);
  assert.equal((await request(rolesPath, null, roleEditor.token)).status, 200);
  assert.equal((await request(path, { role: contributor.id }, roleEditor.token, 'PUT')).status, 200);
  assert.equal((await query.findOne({ where: { id: user.id }, populate: { role: true } })).role.id, contributor.id);
  await request(path, { role: basic.id }, adminToken, 'PUT');

  if (process.env.MEMBER_ROLE_UI_FIXTURE) {
    const fixture = process.env.MEMBER_ROLE_UI_FIXTURE;
    assert.match(fixture, /^\/tmp\/member-roles-[a-z0-9-]+\.json$/);
    await fs.rm(fixture + '.done', { force: true });
    await fs.writeFile(fixture, JSON.stringify({ adminEmail: admin.email, password, readerEmail: reader.email, profileEditorEmail: profileEditor.email, roleEditorEmail: roleEditor.email, memberName: 'Camille Martin', documentId: original.documentId, basicId: basic.id, contributorId: contributor.id }), { mode: 0o600 });
    console.log('Recette navigateur des rôles prête.');
    try {
      let done = false;
      for (let i = 0; i < 300; i++) {
        try { await fs.access(fixture + '.done'); done = true; break; } catch {}
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      assert(done, 'La recette navigateur des rôles doit être terminée.');
    } finally {
      await fs.rm(fixture, { force: true });
      await fs.rm(fixture + '.done', { force: true });
    }
  }
  console.log('OK : rôles depuis la liste, promotion et retrait immédiats, profil préservé, accès anonyme/membre refusé, permissions de lecture et de champ respectées.');
};
