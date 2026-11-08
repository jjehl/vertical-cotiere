const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const migrate = require('../src/lib/migrate-local-storage');

test('migration preserves IDs, transfers variants, resumes after failure and retains sources', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'vertical-storage-'));
  const old = { provider: process.env.UPLOAD_PROVIDER, migrate: process.env.MIGRATE_LOCAL_MEDIA };
  process.env.UPLOAD_PROVIDER = 'aws-s3'; process.env.MIGRATE_LOCAL_MEDIA = 'true';
  try {
    await fs.mkdir(path.join(root, 'uploads'));
    for (const name of ['photo.jpg', 'thumbnail_photo.jpg']) await fs.writeFile(path.join(root, 'uploads', name), 'image');
    const row = { id: 42, provider: 'local', hash: 'photo', url: '/uploads/photo.jpg', formats: { thumbnail: { hash: 'thumbnail_photo', url: '/uploads/thumbnail_photo.jpg' } } };
    let fail = true, updates = 0;
    const provider = { async uploadStream(file) {
      for await (const chunk of file.stream) assert.ok(chunk.length);
      if (fail && file.hash.startsWith('thumbnail')) throw new Error('S3 unavailable');
      file.url = 'https://bucket.example/'+file.hash+'.jpg';
    } };
    const query = { async findMany() { return row.provider === 'local' ? [row] : []; }, async update({ where, data }) { assert.equal(where.id, 42); Object.assign(row, data); updates++; } };
    const strapi = { dirs: { static: { public: root } }, plugin: () => ({ provider }), db: { query: () => query }, log: { info() {} } };
    await assert.rejects(migrate(strapi), /S3 unavailable/);
    assert.equal(updates, 0); assert.equal(row.provider, 'local');
    fail = false; await migrate(strapi);
    assert.equal(updates, 1); assert.equal(row.id, 42); assert.equal(row.provider, 'aws-s3');
    assert.equal(row.formats.thumbnail.url, 'https://bucket.example/thumbnail_photo.jpg');
    await migrate(strapi); assert.equal(updates, 1);
    assert.equal(await fs.readFile(path.join(root, 'uploads/photo.jpg'), 'utf8'), 'image');
  } finally {
    if (old.provider === undefined) delete process.env.UPLOAD_PROVIDER; else process.env.UPLOAD_PROVIDER = old.provider;
    if (old.migrate === undefined) delete process.env.MIGRATE_LOCAL_MEDIA; else process.env.MIGRATE_LOCAL_MEDIA = old.migrate;
    await fs.rm(root, { recursive: true, force: true });
  }
});
