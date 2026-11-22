const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const {readWorkbook,writeWorkbook} = require('../src/lib/member-workbook');

module.exports = async function({app,request,adminToken,token}) {
  const path = '/api/member/directory';
  const users = app.db.query('plugin::users-permissions.user');
  const original = {ffmeLicenseNumber:'000135',firstName:'Élodie',lastName:'Rivière',membershipBirthDate:'2014-02-03',street:'1 rue du Club',
    ffmeLicenseValidUntil:'2027-08-31',clubMembershipValidUntil:'30/06/2027',
    competition:true,membershipSheet:{payerFirstName:'Claude',payerLastName:'Rivière',payerEmail:'famille@transfert.invalid',
      secondPhone:'+33 (0)6 11 22 33 44',secondEmail:'SECOND@transfert.invalid',amount:130,medicalCertificate:'Oui'},guardians:[]};
  const sibling = {...original, ffmeLicenseNumber:'000136', competition:false, membershipBirthDate:'2016-02-03'};
  const second = {firstName:'Dominique',lastName:'Dupont',email:'second@transfert.invalid',phone:'0611223344',membershipBirthDate:'1980-01-01',guardians:[]};
  const makeSource = (members, format) => {
    const book = XLSX.read(writeWorkbook(members, format));
    delete book.Sheets.Responsables;
    book.SheetNames = ['Import_HA'];
    const sheet = book.Sheets.Import_HA;
    for (const [column,label] of Object.entries({A:'Référence',F:"Carte d’adhérent",L:'Tarif',AN:'Cp Naissance',AQ:'Pb',AR:'Pour Licences',AS:'Jeune ?'})) {
      sheet[column+'1'] = {t:'s',v:label};
      sheet[column+'2'] = {t:'s',v:'valeur-exclue'};
    }
    sheet.Q2 = {t:'n',v:41673,z:'dd/mm/yyyy'}; // 2014-02-03
    return XLSX.write(book,{type:'buffer',bookType:format});
  };
  const upload = (buffer,format,jwt) => {
    const form = new FormData();
    form.append('file',new Blob([buffer]),'inscriptions.'+format);
    return request(path+'/import',form,jwt);
  };
  const source = makeSource([original,sibling,second,{...original,firstName:' ELODIE ',lastName:'RIVIERE',membershipBirthDate:'03/02/2014'}],'ods');
  const parsed = await readWorkbook(source,'ods');
  assert.equal(parsed.rows[0].values.membershipBirthDate,'2014-02-03');
  assert(!JSON.stringify(parsed).includes('valeur-exclue'));
  for (const jwt of [null,token]) {
    assert([401,403].includes((await upload(source,'ods',jwt)).status));
    assert([401,403].includes((await request(path+'/export/xlsx',null,jwt)).status));
  }
  const numericBook=XLSX.read(source);
  numericBook.Sheets.Import_HA['AB2']={t:'n',v:612345678};
  const numericRows=await readWorkbook(XLSX.write(numericBook,{type:'buffer',bookType:'xlsx'}),'xlsx');
  assert.equal(numericRows.rows[0].values.secondPhone,'0612345678');
  const basic = await app.db.query('plugin::users-permissions.role').findOne({where:{type:'authenticated'}});
  const legacy = await users.create({data:{username:'ancienne.licence',email:original.membershipSheet.payerEmail,
    firstName:original.firstName,lastName:original.lastName,ffmeLicenseNumber:original.ffmeLicenseNumber,role:basic.id,provider:'local'}});
  const attempts = await Promise.all([upload(source,'ods',adminToken),upload(source,'ods',adminToken)]);
  for (const response of attempts) assert.equal(response.status,200,JSON.stringify(response.body));
  assert.equal(attempts.reduce((sum,r)=>sum+r.body.created,0),4);
  assert.equal(attempts.reduce((sum,r)=>sum+r.body.links,0),4);
  assert.deepEqual(attempts[0].body.warnings,[]);
  const family = await users.findMany({where:{email:'famille@transfert.invalid'},populate:{guardians:true,dependents:true}});
  const child = family.find(person=>person.membershipBirthDate==='2014-02-03');
  const payer = family.find(person=>person.firstName==='Claude');
  assert.notEqual(child.id,legacy.id);
  assert.equal((await users.findOne({where:{id:legacy.id}})).membershipBirthDate,null);
  const withLegacyReference=writeWorkbook([{...original,username:legacy.username,email:legacy.email}], 'xlsx');
  const retried=await upload(withLegacyReference,'xlsx',adminToken);
  assert.equal(retried.body.created,0);assert.equal(retried.body.skipped,0);
  assert.equal(child.ffmeLicenseValidUntil,'2027-08-31');assert.equal(child.clubMembershipValidUntil,'2027-06-30');
  const legacyBook=XLSX.read(makeSource([{...original,clubMembershipValidUntil:null}],'xlsx'));
  const legacySheet=legacyBook.Sheets.Import_HA;
  for(const address of Object.keys(legacySheet)){
    if(legacySheet[address]?.v==='Fin de validité de la licence FFME'){
      delete legacySheet[address];delete legacySheet[address.replace('1','2')];
    }
  }
  assert.equal((await upload(XLSX.write(legacyBook,{type:'buffer',bookType:'xlsx'}),'xlsx',adminToken)).body.skipped,0);
  const keptDates=await users.findOne({where:{id:child.id}});
  assert.equal(keptDates.ffmeLicenseValidUntil,'2027-08-31');assert.equal(keptDates.clubMembershipValidUntil,'2027-06-30');
  const badDate=await upload(makeSource([{...original,ffmeLicenseValidUntil:'31/02/2027'}],'ods'),'ods',adminToken);
  assert.equal(badDate.body.skipped,1);assert.match(badDate.body.warnings[0].message,/licence FFME/);
  assert.equal(child.competition,true);
  assert(!Object.hasOwn(child.membershipSheet,'competition'));
  assert.equal(payer.dependents.length,2);
  assert.equal(child.guardians.length,2);
  const competitors=await request(path+'?memberType=competitor&q=Rivière&pageSize=1',null,adminToken);
  assert.equal(competitors.status,200,JSON.stringify(competitors.body));
  assert.equal(competitors.body.pagination.total,1);
  assert.deepEqual(competitors.body.members.map(person=>person.id),[child.id]);
  assert.equal((await request(path+'?memberType=competitor&role=admin',null,adminToken)).body.pagination.total,0);
  assert.equal((await request(path+'?memberType=unknown',null,adminToken)).status,400);
  const climbers=await request(path+'?memberType=climber&q=Rivière',null,adminToken);
  assert.deepEqual(climbers.body.members.map(person=>person.ffmeLicenseNumber).sort(),['000135','000136']);
  // A competition mark alone does not establish FFME membership.
  await users.update({where:{id:payer.id},data:{competition:true}});
  const contacts=await request(path+'?memberType=contact&q=Rivière',null,adminToken);
  assert.deepEqual(contacts.body.members.map(person=>person.id),[payer.id]);
  assert.equal((await request(path+'?memberType=competitor&q=Rivière',null,adminToken)).body.pagination.total,1);
  const unmarked=makeSource([{...original,competition:false}],'xlsx');
  assert.equal((await upload(unmarked,'xlsx',adminToken)).status,200);
  assert.equal((await users.findOne({where:{id:child.id}})).competition,false);
  assert.equal((await upload(source,'ods',adminToken)).status,200);
  const childDetails = await request(path+'/'+child.id,null,adminToken);
  assert.equal(childDetails.body.secondGuardianContact,null);
  const guardian=childDetails.body.guardians.find(person=>person.email===second.email);
  assert(guardian);
  await users.update({where:{id:child.id},data:{guardians:{disconnect:[guardian.id]}}});
  const unlinked=await request(path+'/'+child.id,null,adminToken);
  assert.deepEqual(unlinked.body.secondGuardianContact,{email:original.membershipSheet.secondEmail,phone:original.membershipSheet.secondPhone});
  await users.update({where:{id:child.id},data:{guardians:{connect:[guardian.id]}}});
  const details = await request(path+'/'+payer.id,null,adminToken);
  assert.deepEqual(details.body.dependents.map(person=>person.id).sort(),payer.dependents.map(person=>person.id).sort());
  // A shared mailbox also belongs to a named member. Only the full pair may identify that member.
  const unnamed = {...original.membershipSheet,secondEmail:' SECOND@transfert.invalid ',secondPhone:'06 88 88 88 88'};
  const extraFamily = makeSource([
    {...original,membershipSheet:unnamed},
    {...sibling,membershipSheet:{...unnamed,secondPhone:'+33 (0)6 88 88 88 88'}},
    {...original,membershipSheet:{...unnamed,secondEmail:'adresse invalide',secondPhone:'06 00 22 33 44'}},
    {...sibling,membershipSheet:{...unnamed,secondEmail:original.membershipSheet.payerEmail,secondPhone:''}},
  ],'xlsx');
  const additions = await Promise.all([upload(extraFamily,'xlsx',adminToken),upload(extraFamily,'xlsx',adminToken)]);
  for (const result of additions) {
    assert.equal(result.status,200,JSON.stringify(result.body));assert.deepEqual(result.body.warnings,[]);
  }
  assert.equal(additions.reduce((sum,r)=>sum+r.body.created,0),3);
  assert.equal(additions.reduce((sum,r)=>sum+r.body.links,0),4);
  const cards = await users.findMany({where:{provider:'contact'},populate:{dependents:true}});
  const shared = cards.find(card=>card.email===second.email);
  const phoneOnly = cards.find(card=>!card.email);
  const emailOnly = cards.find(card=>!card.phone);
  assert.equal(shared.dependents.length,2);assert.equal(phoneOnly.phone,'06 00 22 33 44');
  assert.equal(emailOnly.email,original.membershipSheet.payerEmail);
  for (const card of cards) {
    assert(!card.firstName&&!card.lastName&&!card.membershipBirthDate&&!card.password&&!card.confirmed);
  }
  const directory = await request(path+'?status=contact',null,adminToken);
  assert.deepEqual(directory.body.members.map(row=>row.id).sort(),cards.map(row=>row.id).sort());
  let lastExport;
  for(const format of ['xlsx','ods']) {
    const exported = await fetch('http://127.0.0.1:1347'+path+'/export/'+format,{headers:{authorization:'Bearer '+adminToken}});
    assert.equal(exported.status,200);
    assert.match(exported.headers.get('cache-control'),/no-store/);
    assert.match(exported.headers.get('content-disposition'),/attachment/);
    const buffer = Buffer.from(await exported.arrayBuffer());
    const sheet = XLSX.read(buffer).Sheets.Import_HA;
    for(const column of ['A','F','L','AN','AQ','AR','AS']) assert.equal(sheet[column+'1'],undefined);
    const workbook = await readWorkbook(buffer,format);
    const exportedChild=workbook.rows.find(({values})=>values.username===child.username).values;
    assert.equal(exportedChild.amount,130);assert.equal(exportedChild.street,original.street);
    assert.equal(exportedChild.ffmeLicenseValidUntil,'2027-08-31');assert.equal(exportedChild.clubMembershipValidUntil,'2027-06-30');
    assert.equal(workbook.links.filter(link=>link.member===child.username).length,4);
    assert.equal(workbook.links.filter(link=>link.guardian===shared.username).length,2);
    const phoneRow=workbook.rows.find(({values})=>values.username===phoneOnly.username).values;
    assert(!phoneRow.firstName&&!phoneRow.lastName&&!phoneRow.email);
    assert.equal(phoneRow.phone,phoneOnly.phone);assert.equal(phoneRow.contactCard,'Oui');
    lastExport=buffer;
    const again = await upload(buffer,format,adminToken);
    assert.equal(again.status,200,JSON.stringify(again.body));
    assert.equal(again.body.created,0);assert.equal(again.body.updated,0);assert.equal(again.body.links,0);assert.equal(again.body.skipped,0);
  }
  // Restore a phone-only card from an exported workbook, including its family link.
  await users.delete({where:{id:phoneOnly.id}});
  const restored=await upload(lastExport,'ods',adminToken);
  assert.equal(restored.status,200,JSON.stringify(restored.body));
  assert.equal(restored.body.created,1);assert.equal(restored.body.links,1);
  const restoredPhone=await users.findOne({where:{username:phoneOnly.username},populate:{dependents:true}});
  assert.equal(restoredPhone.provider,'contact');assert.equal(restoredPhone.email,null);
  assert.equal(restoredPhone.dependents[0].id,child.id);

  const ambiguousDetails={email:'partage@exemple.invalid',phone:'0612121212'};
  const ambiguousBook=makeSource([
    {...original,membershipSheet:{...original.membershipSheet,secondEmail:ambiguousDetails.email,secondPhone:ambiguousDetails.phone}},
    {...second,lastName:'Ambre',...ambiguousDetails},
    {...second,lastName:'Jade',...ambiguousDetails},
  ],'xlsx');
  const ambiguous=await upload(ambiguousBook,'xlsx',adminToken);
  assert.equal(ambiguous.body.created,3);assert.equal(ambiguous.body.links,1);
  const unknown=await users.findOne({where:{email:ambiguousDetails.email,provider:'contact'},populate:{dependents:true}});
  assert(!unknown.firstName&&!unknown.lastName);assert.equal(unknown.dependents[0].id,child.id);
  assert.equal((await upload(ambiguousBook,'xlsx',adminToken)).body.created,0);

  const completed=writeWorkbook([{...shared,firstName:'Lou',lastName:'Simon',guardians:[]}],'xlsx');
  assert.equal((await upload(completed,'xlsx',adminToken)).body.updated,1);
  const named=await users.findOne({where:{id:shared.id},populate:{dependents:true}});
  assert.equal(named.firstName,'Lou');assert.equal(named.dependents.length,2);
  const invalid=makeSource([{...original,membershipSheet:{...unnamed,secondPhone:'inconnu',secondEmail:'inconnu'}}],'ods');
  const partial=await upload(invalid,'ods',adminToken);
  assert.equal(partial.status,200);
  assert.equal(partial.body.created,0);
  assert(partial.body.warnings.some(w=>w.line===2&&w.message.includes('Responsable 2')));
  assert.equal((await upload(Buffer.from('incorrect'),'ods',adminToken)).status,400);
  console.log('OK : import et export ODS/XLSX, colonnes écartées, dédoublonnage concurrent, responsables partagés, contacts ambigus et droits administrateur.');
};
