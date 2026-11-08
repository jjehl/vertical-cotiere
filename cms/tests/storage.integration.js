// Run locally: docker compose run --rm --no-deps cms node tests/storage.integration.js
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const createConfig = require('../config/plugins');
const env = (key, fallback) => process.env[key] ?? fallback;
env.bool = (key, fallback) => process.env[key] === undefined ? fallback : process.env[key] === 'true';
(async () => {
  const options = createConfig({ env }).upload.config.providerOptions;
  const provider = require('@strapi/provider-upload-aws-s3').init(options);
  const file = { name: 'storage-smoke.txt', hash: 'storage-smoke-'+Date.now(), ext: '.txt', mime: 'text/plain', size: 0.008, stream: Readable.from(Buffer.from('s3 works')) };
  let uploaded = false;
  try {
    await provider.uploadStream(file); uploaded = true;
    assert.ok(file.url.startsWith(process.env.S3_PUBLIC_URL+'/'));
    const key = new URL(file.url).pathname.slice(new URL(process.env.S3_PUBLIC_URL).pathname.replace(/\/$/, '').length + 1);
    const url = process.env.S3_ENDPOINT+'/'+process.env.S3_BUCKET+'/'+key;
    const get = await fetch(url); assert.equal(get.status, 200); assert.equal(await get.text(), 's3 works');
    const head = await fetch(url, { method: 'HEAD' }); assert.equal(head.status, 200);
    const range = await fetch(url, { headers: { range: 'bytes=0-1' } });
    assert.equal(range.status, 206); assert.equal(await range.text(), 's3');
    const write = await fetch(url, { method: 'PUT', body: 'anonymous write' }); assert.equal(write.status, 403);
    await provider.delete(file); uploaded = false;
    assert.equal((await fetch(url)).status, 404);
    console.log('S3 OK: authenticated upload/delete; public GET/HEAD/range; anonymous write rejected.');
  } finally { if (uploaded) await provider.delete(file); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
