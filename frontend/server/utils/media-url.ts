// Only the configured bucket may be fetched. Never follow arbitrary CMS URLs.
export function resolveMediaUrl(storageUrl: string, cmsUrl: string, publicBase: string, internalBase = ''): string {
  if (/^\/uploads\/[a-zA-Z0-9_.-]+$/.test(storageUrl)) return cmsUrl + storageUrl;
  if (!publicBase) throw new Error('Missing media bucket URL');
  const base = new URL(publicBase.replace(/\/$/, '') + '/');
  const target = new URL(storageUrl);
  if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password ||
      target.origin !== base.origin || !target.pathname.startsWith(base.pathname) || target.search || target.hash) {
    throw new Error('Invalid media URL');
  }
  const key = target.pathname.slice(base.pathname.length);
  if (!key || !/^[a-zA-Z0-9_./-]+$/.test(key) || key.split('/').some(part => part === '..' || part === '.')) throw new Error('Invalid media key');
  return (internalBase || publicBase).replace(/\/$/, '') + '/' + key;
}
