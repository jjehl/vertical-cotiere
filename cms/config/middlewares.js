module.exports = ({ env }) => [
  'strapi::logger', 'strapi::errors',
  { name: 'strapi::security', config: { contentSecurityPolicy: { useDefaults: true, directives: {
    upgradeInsecureRequests: env('NODE_ENV') === 'production' ? [] : null,
    'img-src': ["'self'", 'data:', 'blob:', 'market-assets.strapi.io', ...(env('S3_PUBLIC_URL') ? [new URL(env('S3_PUBLIC_URL')).origin] : [])],
    'media-src': ["'self'", 'data:', 'blob:', ...(env('S3_PUBLIC_URL') ? [new URL(env('S3_PUBLIC_URL')).origin] : [])],
  } } } },
  'strapi::cors', 'strapi::poweredBy', 'strapi::query', 'strapi::body', 'strapi::session',
  'strapi::favicon', 'strapi::public',
];
