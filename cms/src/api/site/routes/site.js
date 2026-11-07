module.exports = {
  routes: [
    { method: 'GET', path: '/publications/:slug', handler: 'site.publication', config: { auth: false } },
    { method: 'GET', path: '/publication-link', handler: 'site.publicationAlias', config: { auth: false } },
    { method: 'GET', path: '/site-content', handler: 'site.content', config: { auth: false } },
    { method: 'GET', path: '/gallery', handler: 'site.albums', config: { auth: false } },
    { method: 'GET', path: '/gallery/:slug', handler: 'site.album', config: { auth: false } },
    { method: 'GET', path: '/library', handler: 'site.documents', config: { auth: false } },
    { method: 'GET', path: '/library/:slug', handler: 'site.documentFile', config: { auth: false } },
    { method: 'GET', path: '/site-files/:id', handler: 'site.file', config: { auth: false } },
    { method: 'GET', path: '/gallery-files/:id', handler: 'site.galleryFile', config: { auth: false } },
    { method: 'GET', path: '/legacy-assets/:file', handler: 'site.legacyAsset', config: { auth: false } },
  ],
};
