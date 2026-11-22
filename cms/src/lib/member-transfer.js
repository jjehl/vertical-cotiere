const {randomUUID} = require('node:crypto');
const {readFile} = require('node:fs/promises');
const {extname} = require('node:path');
const {fields,validityDates,memberDateFields} = require('./member-profile');
const {memberTypes} = require('./member-roles');
const {authorize} = require('./member-directory');
const {readWorkbook, writeWorkbook, extraColumns, maxFileBytes, WorkbookError} = require('./member-workbook');

const uid = 'plugin::users-permissions.user';
const select = ['id','username','email',...Object.keys(fields),...memberDateFields,'membershipSheet','provider','competition'];
const where = {role:{type:{$in:memberTypes}}};
const validEmail = email => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const {normalize, nameKey, validDate, emailKey, phoneKey} = require('./member-identity');
function contactDetails(rawEmail, rawPhone) {
  const email = emailKey(rawEmail);
  const phone = phoneKey(rawPhone);
  const address = validEmail(email) ? email : null;
  return {email:address, phone:phone ? rawPhone : null, key:address || phone ? JSON.stringify([address,phone]) : null};
}
async function applyWorkbook(app, workbook) {
  const users = app.db.query(uid);
  const accounts = await users.findMany({where, select, populate:{guardians:{select:['id']}}});
  const role = await app.db.query('plugin::users-permissions.role').findOne({where:{type:'authenticated'}});
  const byName = new Map();
  const byUsername = new Map();
  const byContact = new Map();
  const refs = new Map();
  function index(account) {
    const key = nameKey(account);
    if (!byName.has(key)) byName.set(key, new Set());
    byName.get(key).add(account);
    byUsername.set(account.username, account);
    const contact = contactDetails(account.email,account.phone);
    if (contact.key) {
      if (!byContact.has(contact.key)) byContact.set(contact.key,new Set());
      byContact.get(contact.key).add(account);
    }
  }
  accounts.forEach(index);
  const created = new Set();
  const updated = new Set();
  const report = {processed:0, skipped:0, created:0, updated:0, links:0, warnings:[]};
  function warn(sheet, line, message) { report.warnings.push({sheet,line,message}); }
  async function createAccount(data, username, provider = 'local') {
    const account = await users.create({data:{
      ...data, username:username || 'adherent.' + randomUUID(), provider, role:role.id, confirmed:false, blocked:false,
    }, select});
    account.guardians = [];
    index(account);
    created.add(account.id);
    return account;
  }
  async function connect(member, guardian) {
    if (member.id === guardian.id || member.guardians.some(person => person.id === guardian.id)) return;
    await users.update({where:{id:member.id}, data:{guardians:{connect:[guardian.id]}}});
    member.guardians.push({id:guardian.id});
    report.links++;
  }

  const familyRows = [];
  const secondGuardians = [];
  for (const {line, values} of workbook.rows) {
    const {firstName, lastName, membershipBirthDate:dob, username} = values;
    const skip = message => {report.skipped++; warn('Import_HA', line, message);};
    if ((!username && !dob) || (dob && (!firstName || !lastName || !validDate(dob)))) {
      skip('Nom, prénom ou date de naissance manquant ou invalide.'); continue;
    }
    const invalidDate = Object.keys(validityDates).find(key => values[key] && !validDate(values[key]));
    if (invalidDate) {skip(validityDates[invalidDate] + ' invalide.'); continue;}
    if (Object.entries(fields).some(([key, max]) => values[key]?.length > max) ||
        extraColumns.some(([key]) => values[key]?.length > 4000) || (username && username.length > 254)) {
      skip('Une valeur dépasse la longueur autorisée.'); continue;
    }
    const candidates = [...(byName.get(nameKey(values)) || [])];
    const dated = dob ? candidates.filter(person => person.membershipBirthDate === dob) : [];
    const identified = username && byUsername.get(username);
    const contactRow = values.contactCard === 'Oui';
    const contact = contactDetails(values.email,values.phone);
    const compatibleCard = person => person.provider === 'contact' &&
      ['firstName','lastName','membershipBirthDate'].every(key => !person[key] || !values[key] || normalize(person[key]) === normalize(values[key]));
    if (dated.length > 1 || (!dob && identified && nameKey(identified) !== nameKey(values) && !compatibleCard(identified))) {
      skip('Plusieurs identités possibles. Vérifiez la fiche membre.'); continue;
    }
    // A dated row is a person identified by the full triplet. A workbook username also serves as a link reference.
    let member = dob ? dated[0] : identified;
    if (!member && !dob && contactRow) {
      const cards = [...(byContact.get(contact.key) || [])].filter(compatibleCard);
      if (cards.length > 1) {skip('Plusieurs fiches contact ont ces coordonnées. Vérifiez leurs identifiants.'); continue;}
      member = cards[0];
    }
    // Login addresses on existing accounts can only change through the verified profile flow.
    const email = emailKey(values.email || values.payerEmail);
    if (!member && contactRow && !contact.key && !(firstName && lastName)) {skip('Indiquez un e-mail ou un téléphone valide pour la fiche contact sans identité complète.'); continue;}
    if (!member && !contactRow && !validEmail(email)) {skip('Une adresse e-mail valide est nécessaire pour créer la fiche.'); continue;}
    const data = {};
    if (Object.hasOwn(values,'competition') && values.competition !== (member?.competition ?? false)) data.competition = values.competition;
    if (member?.provider === 'contact' && contactRow && contact.email && member.email !== contact.email) data.email = contact.email;
    for (const key of [...Object.keys(fields), ...memberDateFields]) {
      if (member && ['firstName','lastName'].includes(key) && normalize(values[key]) === normalize(member[key])) continue;
      if (values[key] && values[key] !== member?.[key]) data[key] = values[key];
    }
    const extras = Object.fromEntries(extraColumns.filter(([key]) => Object.hasOwn(values,key)).map(([key]) => [key, values[key]]));
    // These two cells describe one contact on this row, even if one of them is empty.
    const hasSecondContact = Boolean(values.secondEmail || values.secondPhone);
    const secondContactChanged = member && hasSecondContact && ['secondEmail','secondPhone'].some(key =>
      (member.membershipSheet?.[key] || '') !== (values[key] || ''));
    if (hasSecondContact) Object.assign(extras,{secondEmail:values.secondEmail || null, secondPhone:values.secondPhone || null});
    if (Object.entries(extras).some(([key, value]) => member?.membershipSheet?.[key] !== value)) {
      data.membershipSheet = {...member?.membershipSheet, ...extras};
    }
    if (!member) {
      const availableUsername = identified ? undefined : username;
      member = contactRow
        ? await createAccount({...data,email:contact.email,phone:contact.phone}, availableUsername, 'contact')
        : await createAccount({...data,email}, availableUsername);
    } else if (Object.keys(data).length) {
      await users.update({where:{id:member.id}, data});
      byName.get(nameKey(member)).delete(member);
      byContact.get(contactDetails(member.email,member.phone).key)?.delete(member);
      Object.assign(member, data);
      index(member);
      if (!created.has(member.id)) updated.add(member.id);
    }
    report.processed++;
    if (username) {
      if (refs.has(username) && refs.get(username).id !== member.id) throw new WorkbookError('Un identifiant désigne deux membres dans le classeur.');
      refs.set(username, member);
    }
    if (!workbook.hasLinkSheet || !username) familyRows.push({line,values,member});
    // An unmodified export already carries its links. New or edited contact cells need resolving.
    if (hasSecondContact && (!workbook.hasLinkSheet || !username || !workbook.hasContactCards || secondContactChanged)) {
      secondGuardians.push({line,values,member});
    }
  }

  // Resolve named payers after participants so an adult with their own row has a single account.
  for (const {line,values,member} of familyRows) {
    const payer = {firstName:values.payerFirstName, lastName:values.payerLastName, email:emailKey(values.payerEmail)};
    if (!payer.firstName && !payer.lastName && !payer.email) continue;
    if (!payer.firstName || !payer.lastName || payer.firstName.length > fields.firstName || payer.lastName.length > fields.lastName || !validEmail(payer.email)) {
      warn('Import_HA',line,'Identité du payeur incomplète. Coordonnées conservées.'); continue;
    }
    const namesakes = [...(byName.get(nameKey(payer)) || [])];
    const candidates = namesakes.filter(person => emailKey(person.email) === payer.email);
    if (candidates.length > 1 || (namesakes.length && !candidates.length)) {
      warn('Import_HA',line,'Identité du payeur à vérifier. Coordonnées conservées.'); continue;
    }
    const guardian = candidates[0] || await createAccount(payer);
    await connect(member, guardian);
  }
  for (const {line,member,guardian} of workbook.links) {
    const child = refs.get(member);
    const parent = refs.get(guardian);
    if (!child || !parent || child.id === parent.id) warn('Responsables',line,'Lien invalide. Vérifiez les deux identifiants dans Import_HA.');
    else await connect(child, parent);
  }
  for (const {line,values,member} of secondGuardians) {
    const contact = contactDetails(values.secondEmail,values.secondPhone);
    if (!contact.key) {
      warn('Import_HA',line,'Responsable 2 sans coordonnées utilisables. Vérifiez l’e-mail ou le téléphone.'); continue;
    }
    const matches = [...(byContact.get(contact.key) || [])].filter(person => person.id !== member.id);
    // An email or phone alone can be shared with a child or another named family member.
    const cards = matches.filter(person => person.provider === 'contact');
    const linkedCard = cards.find(card => member.guardians.some(existing => existing.id === card.id));
    const named = contact.email && contact.phone && matches.length === 1 ? matches[0] : null;
    const guardian = linkedCard || cards[0] || named || await createAccount({email:contact.email,phone:contact.phone}, undefined, 'contact');
    await connect(member, guardian);
  }
  report.created = created.size;
  report.updated = updated.size;
  return report;
}

async function importWorkbook(app, workbook) {
  return app.db.transaction(async ({trx}) => {
    // Share the lock with registration account creation, including concurrent imports.
    await trx.raw('SELECT pg_advisory_xact_lock(2672027)');
    return applyWorkbook(app, workbook);
  });
}

async function importDirectory(app, ctx) {
  authorize(ctx);
  const file = ctx.request.files?.file;
  const format = extname(file?.originalFilename || '').slice(1).toLowerCase();
  if (!file || Array.isArray(file) || !['xlsx','ods'].includes(format)) ctx.throw(400,'Sélectionnez un fichier XLSX ou ODS.');
  if (file.size > maxFileBytes) ctx.throw(413,'Le classeur dépasse 8 Mo.');
  try {
    const workbook = await readWorkbook(await readFile(file.filepath), format);
    ctx.body = await importWorkbook(app, workbook);
  } catch (error) {
    if (error instanceof WorkbookError) ctx.throw(400,error.message);
    throw error;
  }
}
async function exportDirectory(app, ctx) {
  authorize(ctx);
  const format = ctx.params.format;
  if (!['xlsx','ods'].includes(format)) ctx.throw(400,'Format de classeur inconnu.');
  const members = await app.db.query(uid).findMany({where,select,orderBy:[{lastName:'asc'},{firstName:'asc'},{id:'asc'}],
    populate:{guardians:{where, select:['username','firstName','lastName','email','phone']}}});
  ctx.attachment('membres-vertical-cotiere.' + format);
  ctx.type = format === 'ods' ? 'application/vnd.oasis.opendocument.spreadsheet' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  ctx.body = writeWorkbook(members, format);
}
module.exports = {importWorkbook, importDirectory, exportDirectory};
