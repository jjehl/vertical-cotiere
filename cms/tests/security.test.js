const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Koa = require('koa');
const { security } = require(path.join(path.dirname(require.resolve('@strapi/core')), 'middlewares/security.js'));
const middlewares = require('../config/middlewares');

for (const environment of ['development', 'production']) {
  test(`CSP works with Strapi defaults in ${environment}`, async () => {
    const values = { NODE_ENV: environment, S3_PUBLIC_URL: 'https://media.example.org' };
    const config = middlewares({ env: key => values[key] }).find(item => item.name === 'strapi::security').config;
    const app = new Koa();
    app.use(security(config, { strapi: { plugin: () => undefined, config: { get: () => '/admin' } } }));
    app.use(ctx => { ctx.status = 204; });
    const server = app.listen(0, '127.0.0.1');
    try {
      await new Promise(resolve => server.once('listening', resolve));
      const response = await fetch(`http://127.0.0.1:${server.address().port}/_health`);
      assert.equal(response.status, 204);
      const csp = response.headers.get('content-security-policy');
      assert.ok(csp.includes('https://media.example.org'));
      assert.equal(csp.includes('upgrade-insecure-requests'), environment === 'production');
    } finally {
      server.closeAllConnections();
      await new Promise(resolve => server.close(resolve));
    }
  });
}
