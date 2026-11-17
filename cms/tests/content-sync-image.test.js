const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const sharp=require('sharp');
const {recoverJpeg}=require('../src/lib/content-sync-image');
const fixture=require('./jpeg-fixture.cjs');

test('Un JPEG historique endommagé est réencodé, validé et nettoyé sans modifier la source',async()=>{
  const {damaged}=await fixture(),directory=await fs.mkdtemp(path.join(os.tmpdir(),'sync-image-test-'));
  const filepath=path.join(directory,'source.jpg');let recovered;
  try{
    await fs.writeFile(filepath,damaged);
    await assert.rejects(()=>sharp(filepath).stats(),/VipsJpeg: Corrupt JPEG data:/);
    recovered=await recoverJpeg({filepath,size:damaged.length,originalFilename:'archive.jpg'},{mime:'image/jpeg',name:'archive.jpg'});
    await sharp(recovered.file.filepath).stats();
    const metadata=await sharp(recovered.file.filepath).metadata();
    assert.equal(metadata.width,64);assert.equal(metadata.height,64);assert.equal(metadata.orientation,6);
    assert.equal(recovered.file.originalFilename,'archive.jpg');
    assert.equal(recovered.file.size,(await fs.stat(recovered.file.filepath)).size);
    assert.deepEqual(await fs.readFile(filepath),damaged);
    await recovered.cleanup();await assert.rejects(()=>fs.stat(recovered.file.filepath),{code:'ENOENT'});
  }finally{await recovered?.cleanup();await fs.rm(directory,{recursive:true,force:true});}
});

test('Une image valide ou irrécupérable ne passe pas par la récupération JPEG',async()=>{
  const {original}=await fixture(),directory=await fs.mkdtemp(path.join(os.tmpdir(),'sync-image-test-'));
  const filepath=path.join(directory,'source.jpg');
  const invalid=error=>error.status===422&&error.message.includes('archive.jpg');
  try{
    await fs.writeFile(filepath,original);
    await assert.rejects(()=>recoverJpeg({filepath},{mime:'image/jpeg',name:'archive.jpg'}),invalid);
    await fs.writeFile(filepath,'not an image');
    await assert.rejects(()=>recoverJpeg({filepath},{mime:'image/jpeg',name:'archive.jpg'}),invalid);
    await assert.rejects(()=>recoverJpeg({filepath},{mime:'image/png',name:'archive.jpg'}),invalid);
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});
