module.exports = ({ env }) => ({
  host: '0.0.0.0',
  port: 1337,
  url: env('PUBLIC_CMS_URL', 'http://localhost:1337'),
  proxy: { koa: true },
  logger: { updates: { enabled: false } },
  app: { keys: env.array('APP_KEYS') },
});
