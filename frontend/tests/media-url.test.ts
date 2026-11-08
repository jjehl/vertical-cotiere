import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMediaUrl } from '../server/utils/media-url.ts';
const base = 'https://bucket.s3.example.org';
test('local uploads remain readable during migration', () => {
  assert.equal(resolveMediaUrl('/uploads/photo.jpg', 'http://cms:1337', base), 'http://cms:1337/uploads/photo.jpg');
});
test('local S3 URL maps to Docker endpoint, including bucket prefix', () => {
  assert.equal(resolveMediaUrl('http://localhost:8333/vertical-media/photo.jpg', 'http://cms:1337', 'http://localhost:8333/vertical-media', 'http://seaweedfs:8333/vertical-media'), 'http://seaweedfs:8333/vertical-media/photo.jpg');
});
test('OVH media uses its configured bucket', () => {
  assert.equal(resolveMediaUrl(base+'/photo.jpg', 'http://cms:1337', base), base+'/photo.jpg');
});
test('reject arbitrary origins, bucket confusion, credentials and URL tricks', () => {
  for (const url of ['http://169.254.169.254/x', 'https://bucket.s3.example.org.evil.org/x', 'https://user@bucket.s3.example.org/x', base+'/photo.jpg?url=x', '/uploads/../secret', base+'/x%2fy', 'file:///etc/passwd']) {
    assert.throws(() => resolveMediaUrl(url, 'http://cms:1337', base));
  }
  assert.throws(() => resolveMediaUrl('http://localhost:8333/vertical-media-evil/photo.jpg', 'http://cms:1337', 'http://localhost:8333/vertical-media'));
});
