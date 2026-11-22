const {normalize,emailKey,nameKey}=require('./member-identity');
const {memberTypes}=require('./member-roles');
const uid='plugin::users-permissions.user';
const legacyUsername=/^adherent\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function usernameBase(person) {
  const part=value=>normalize(value).replace(/œ/g,'oe').replace(/æ/g,'ae').replace(/ß/g,'ss')
    .replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'');
  const base=[part(person.firstName),part(person.lastName)].filter(Boolean).join('.');
  return base.length>=3 ? base : base ? 'membre.'+base : 'contact';
}

function takeUsername(base,occupied) {
  let candidate=base;
  for(let suffix=2;occupied.has(candidate.toLowerCase());suffix++) candidate=base+suffix;
  occupied.add(candidate.toLowerCase());
  return candidate;
}

// Automatic account creation shares the transaction lock used by registrations and imports.
async function allocateUsername(users,person) {
  const base=usernameBase(person);
  const rows=await users.findMany({where:{username:{$startsWithi:base}},select:['username']});
  return takeUsername(base,new Set(rows.map(row=>row.username.toLowerCase())));
}

async function migrateUsernames(app) {
  const marker=app.store({type:'core',name:'vertical-admin',key:'member-directory-usernames-v1'});
  await app.db.transaction(async({trx})=>{
    await trx.raw('SELECT pg_advisory_xact_lock(2672027)');
    if(await marker.get())return;
    const users=app.db.query(uid);
    const all=await users.findMany({select:['username']});
    const occupied=new Set(all.map(row=>row.username.toLowerCase()));
    const rows=await users.findMany({where:{username:{$startsWith:'adherent.'},role:{type:{$in:memberTypes}}},
      select:['id','username','firstName','lastName','email','membershipSheet','provider','confirmed','blocked','password','googleSubject','confirmationToken'],
      populate:{role:{select:['type']},dependents:{select:['membershipSheet']}},orderBy:{id:'asc'}});
    let renamed=0,activated=0;
    for(const row of rows) {
      if(!legacyUsername.test(row.username))continue;
      const wasImported=row.membershipSheet || row.dependents.some(({membershipSheet:sheet})=>
        sheet && emailKey(sheet.payerEmail)===emailKey(row.email) &&
        nameKey({firstName:sheet.payerFirstName,lastName:sheet.payerLastName})===nameKey(row));
      const data={legacyDirectoryUsername:row.username,username:takeUsername(usernameBase(row),occupied)};
      if(wasImported && row.provider==='local' && row.role.type==='authenticated' && row.email &&
          !row.confirmed && !row.blocked && !row.password && !row.googleSubject && !row.confirmationToken) {
        data.confirmed=true;
        activated++;
      }
      await users.update({where:{id:row.id},data});
      renamed++;
    }
    await marker.set({value:{renamed,activated}});
  });
}
module.exports={usernameBase,takeUsername,allocateUsername,legacyUsername,migrateUsernames};
