// Explicit local operation; never runs during CMS bootstrap or deployment.
const {Client}=require('pg');
const site=new URL(process.env.PUBLIC_SITE_URL||'http://localhost:3000');
if(process.env.NODE_ENV!=='development'||process.env.SEED_CONTENT!=='true'||!['localhost','127.0.0.1','[::1]'].includes(site.hostname))throw new Error('Cette initialisation est réservée au projet local de développement.');
(async()=>{
  const db=new Client({host:process.env.DATABASE_HOST,user:process.env.DATABASE_USERNAME,password:process.env.DATABASE_PASSWORD,database:process.env.DATABASE_NAME});
  await db.connect();
  try {
    const result=await db.query('UPDATE components_schedule_training_slot SET price_cents=$1,ccmp_price_cents=$2,family_price_cents=$3,ccmp_family_price_cents=$4',[16000,15000,14000,13000]);
    console.log(result.rowCount+' versions de créneaux mises à jour : standard 160 €, CCMP 150 €, famille hors CCMP 140 €, famille CCMP 130 €.');
  }finally{await db.end();}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
