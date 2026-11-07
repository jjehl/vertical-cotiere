// Tiny image fixtures for isolated CI only. Never modifies a real gallery.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { resolve, basename, dirname } from 'node:path';
if (process.env.CI !== 'true' || !process.argv[2]) throw new Error('Usage réservé à la recette : CI=true node scripts/create-ci-gallery.mjs <dossier inexistant>');
const output=resolve(process.argv[2]);
try { await access(output); throw new Error('Le dossier existe déjà : aucune photo ne sera écrasée.'); }
catch(error) { if(error.code!=='ENOENT') throw error; }
const albums=JSON.parse(await readFile(new URL('../content/gallery.json',import.meta.url),'utf8'));
// Valid 16 × 12 JPEG, deliberately unrelated to the club’s actual photographs.
const jpeg=Buffer.from('/9j/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAMABADASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABgf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCMAIqa/9k=','base64');
await mkdir(dirname(output),{recursive:true});
await mkdir(output);
const files=new Set(albums.flatMap(a=>a.photos.flatMap(p=>[basename(p.src),basename(p.thumb)])));
for(const file of files) await writeFile(resolve(output,file),jpeg,{flag:'wx'});
console.log(`${files.size} images de recette créées dans ${output}.`);
