export default defineNuxtConfig({
  compatibilityDate: '2026-11-07',
  devtools: { enabled: false },
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'Vertical Côtière — L’escalade, ensemble',
      meta: [{ name: 'description', content: 'Cours d’escalade, compétition et sorties en pleine nature. Découvrez Vertical Côtière, votre club à Beynost, dans l’Ain.' }, { name: 'theme-color', content: '#233b31' }],
      link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    },
  },
  runtimeConfig: {
    cmsUrl: 'http://localhost:1337',
    mediaPublicBaseUrl: '',
    mediaInternalBaseUrl: '',
  },
  typescript: { strict: true },
})
