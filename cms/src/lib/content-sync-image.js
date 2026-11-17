const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const sharp=require('sharp');

// Some legacy JPEGs have a damaged entropy segment but still decode with a
// warning. Re-encode only those files; the ordinary upload keeps strict checks.
async function recoverJpeg(file,descriptor){
  const invalid=()=>{
    const error=Error('Image illisible : '+descriptor.name+'. Remplacer le fichier source avant de relancer la synchronisation.');
    error.status=422;throw error;
  };
  if(descriptor.mime!=='image/jpeg')invalid();
  let warning;
  try{await sharp(file.filepath).stats();}catch(error){warning=error.message;}
  if(!warning?.startsWith('VipsJpeg: Corrupt JPEG data:'))invalid();
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'vertical-sync-jpeg-'));
  const filepath=path.join(directory,'recovered.jpg');
  const cleanup=()=>fs.rm(directory,{recursive:true,force:true});
  try{
    await sharp(file.filepath,{failOn:'error'}).withMetadata().jpeg({quality:95,chromaSubsampling:'4:4:4'}).toFile(filepath);
    await sharp(filepath).stats();
    const {size}=await fs.stat(filepath);
    if(size>50*1024*1024)invalid();
    return {file:{...file,filepath,size},cleanup};
  }catch(error){
    await cleanup();
    if(error.code)throw error;
    invalid();
  }
}
module.exports={recoverJpeg};
