const fs = require('node:fs');
const path = require('node:path');

// Resumable: DB rows change only after all variants have uploaded successfully.
// Source files remain on disk so a failed run can be retried after restoring access.
module.exports = async function migrateLocalStorage(strapi) {
  if (process.env.MIGRATE_LOCAL_MEDIA !== 'true' || process.env.UPLOAD_PROVIDER !== 'aws-s3') return;
  const provider = strapi.plugin('upload').provider;
  const query = strapi.db.query('plugin::upload.file');
  const root = path.resolve(strapi.dirs.static.public, 'uploads');
  async function upload(file) {
    if (!/^\/uploads\/[a-zA-Z0-9_.-]+$/.test(file.url)) throw new Error(`Invalid local media URL for ${file.hash}`);
    const source = path.join(root, path.basename(file.url));
    const stat = await fs.promises.stat(source);
    const target = { ...file, sizeInBytes: stat.size, stream: fs.createReadStream(source) };
    try { await provider.uploadStream(target); }
    finally { target.stream.destroy(); }
    return { ...file, url: target.url, provider_metadata: target.provider_metadata };
  }
  // A migrated row leaves the selection, so always read the first batch.
  for (;;) {
    const rows = await query.findMany({ where: { provider: 'local' }, limit: 50 });
    if (!rows.length) break;
    for (const file of rows) {
      const main = await upload(file);
      const formats = {};
      for (const [name, variant] of Object.entries(file.formats || {})) formats[name] = await upload(variant);
      await query.update({ where: { id: file.id }, data: {
        url: main.url, provider: 'aws-s3', provider_metadata: main.provider_metadata, formats,
      } });
    }
    strapi.log.info(`Stockage S3 : ${rows.length} médias transférés (sources locales conservées).`);
  }
};
