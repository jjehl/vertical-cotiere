const XLSX = require('xlsx');
const {frenchAddress} = require('./member-format');
const {validityDates,memberDateFields} = require('./member-profile');
const yauzl = require('yauzl');

const maxFileBytes = 8 * 1024 * 1024;
const maxRows = 10000;
const memberSheet = 'Import_HA';
const linkSheet = 'Responsables';

// The empty slots preserve the coordinates of the club's original workbook.
const columns = [
  null,
  ['orderDate', 'Date de la commande'], ['orderStatus', 'Statut de la commande'],
  ['lastName', 'Nom adhérent'], ['firstName', 'Prénom adhérent'], null,
  ['payerLastName', 'Nom payeur'], ['payerFirstName', 'Prénom payeur'], ['payerEmail', 'Email payeur'],
  ['organization', 'Raison sociale'], ['paymentMethod', 'Moyen de paiement'], null,
  ['amount', 'Montant tarif'], ['promo', 'Code Promo'], ['promoAmount', 'Montant code promo'],
  ['sex', 'Sexe'], ['membershipBirthDate', 'Date de naissance'],
  ['imageConsent', "J'autorise la publication de mon image sur le site du club"],
  ['healthQuestionnaire', 'J’atteste avoir rempli le questionnaire de santé ( répondre oui )'],
  ['medicalCertificate', 'J\'ai répondu "oui" à au moins une question du questionnaire de santé , je dois fournir un Certificat médical à téléverser ci-dessous'],
  ['healthNote', 'Problème de santé que vous souhaitez signaler'], ['grade', 'Classe'], ['course', 'Cours suivi en 25-26'],
  ['street', 'Adresse postale numéro , rue'], ['postalCode', 'Code postal'], ['city', 'Commune'],
  ['emergencyPhone', "Tel en cas d'urgence"], ['secondPhone', 'Tel responsable 2'], ['secondEmail', 'Email responsable 2'],
  ['normalizedLastName', 'Nom'], ['normalizedFirstName', 'Prenom'], ['normalizedSex', 'Sexe'],
  ['ffmeLicenseNumber', 'Licences'], ['ffmeBirthDate', 'Date de naissance FFME'], ['ffmeLastName', 'Nom FFME'],
  ['ffmeFirstName', 'Prénom FFME'], ['ffmeStreet', 'Adresse FFME'], ['ffmePostalCode', 'Code postal FFME'], ['ffmeCity', 'Ville FFME'],
  null, ['ccmp', 'CCMP'], ['competition', 'Competition'], null, null, null,
  ['email', 'E-mail membre'], ['phone', 'Téléphone membre'], ['country', 'Pays'], ['username', 'Identifiant membre'], ['contactCard', 'Fiche contact'],
  ...Object.entries(validityDates),
];
const headerKey = value => String(value ?? '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');
const profileKeys = new Set(['firstName', 'lastName', 'email', 'phone', 'country', 'street', 'postalCode', 'city', 'ffmeLicenseNumber', ...memberDateFields, 'username', 'contactCard', 'competition']);
const extraColumns = columns.filter(column => column && !profileKeys.has(column[0]));
const linkColumns = ['Identifiant adhérent', 'Identifiant responsable', 'Adhérent', 'Responsable'];

class WorkbookError extends Error {}

// Inspect the ZIP directory before the spreadsheet parser expands the file.
async function checkArchive(buffer, format) {
  if (buffer.length > maxFileBytes) throw new WorkbookError('Le classeur dépasse 8 Mo.');
  await new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, {lazyEntries: true}, (error, zip) => {
      if (error) return reject(new WorkbookError('Le fichier doit être un classeur XLSX ou ODS.'));
      let bytes = 0;
      let recognized = false;
      zip.on('error', () => reject(new WorkbookError('Archive de classeur illisible.')));
      zip.on('entry', entry => {
        bytes += entry.uncompressedSize;
        if (bytes > 64 * 1024 * 1024 || zip.entryCount > 2000 || entry.isEncrypted()) {
          zip.close();
          return reject(new WorkbookError('Classeur trop volumineux ou protégé par mot de passe.'));
        }
        if (entry.fileName === (format === 'ods' ? 'content.xml' : 'xl/workbook.xml')) recognized = true;
        zip.readEntry();
      });
      zip.on('end', () => recognized ? resolve() : reject(new WorkbookError('Le contenu du classeur ne correspond pas à son extension.')));
      zip.readEntry();
    });
  });
}

const address = (row, column) => XLSX.utils.encode_cell({r: row, c: column});
function cellText(cell) {
  if (!cell || cell.t === 'e' || cell.v == null) return '';
  return String(cell.w ?? cell.v).trim();
}

function workbookDate(cell, date1904) {
  if (cell?.t === 'e') return 'invalide';
  if (cell?.t === 'n') {
    const date = XLSX.SSF.parse_date_code(cell.v, {date1904});
    if (!date) return 'invalide';
    return [date.y, date.m, date.d].map((n, i) => String(n).padStart(i ? 2 : 4, '0')).join('-');
  }
  const value = cellText(cell);
  const french = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  return french ? french[3] + '-' + french[2].padStart(2, '0') + '-' + french[1].padStart(2, '0') : value;
}

function lastRow(sheet) {
  const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'] || 'A1');
  if (range.e.r > maxRows) throw new WorkbookError('Chaque feuille peut contenir jusqu’à 10 000 lignes de données.');
  return range.e.r;
}

async function readWorkbook(buffer, format) {
  await checkArchive(buffer, format);
  let book;
  try {
    book = XLSX.read(buffer, {type:'buffer', sheets:[memberSheet, linkSheet], sheetRows:maxRows + 2, cellFormula:false, cellHTML:false});
  } catch {
    throw new WorkbookError('Impossible de lire le classeur.');
  }
  const sheet = book.Sheets[memberSheet];
  if (!sheet) throw new WorkbookError('L’onglet Import_HA est introuvable.');
  const header = col => headerKey(cellText(sheet[address(0, col)]));
  for (const col of [3, 4, 16]) {
    if (header(col) !== headerKey(columns[col][1])) throw new WorkbookError('Les colonnes D, E et Q doivent contenir le nom adhérent, le prénom adhérent et la date de naissance.');
  }
  const rows = [];
  const end = lastRow(sheet);
  const active = columns.map((column, i) => {
    if (!column) return null;
    // AH–AM are the unnamed results of the FFME lookup in the original ODS.
    if (i >= 33 && i <= 38 && !header(i)) return column[0];
    if (header(i) !== headerKey(column[1])) {
      if (header(i)) throw new WorkbookError('En-tête inattendu en ' + address(0, i) + '. Utilisez le modèle Import_HA.');
      return null;
    }
    return column[0];
  });
  const phoneColumns=['phone','secondPhone'].map(key=>[key,active.indexOf(key)]).filter(([,i])=>i>=0);
  for (let r = 1; r <= end; r++) {
    const values = {};
    for (const [i, key] of active.entries()) {
      if (!key) continue;
      const cell = sheet[address(r, i)];
      let value = cellText(cell);
      if (key === 'competition') value = ['x','true','1','oui','vrai'].includes(String(cell?.v ?? '').trim().toLowerCase());
      if (memberDateFields.includes(key)) value = workbookDate(cell, !!book.Workbook?.WBProps?.date1904);
      if (key === 'ffmeLicenseNumber' && /^#(?:N\/A|VALUE!|REF!)$/i.test(value)) continue;
      if (['amount','promoAmount'].includes(key) && cell?.t === 'n') value = cell.v;
      if (value !== '') values[key] = value;
    }
    // A French national number entered as a number in a spreadsheet loses its initial zero.
    if (frenchAddress(values.country)) {
      for (const [key,i] of phoneColumns) {
        if (sheet[address(r,i)]?.t==='n' && /^[1-9]\d{8}$/.test(values[key])) values[key]='0'+values[key];
      }
    }
    // Ignore the template's unused rows, which still have calculated cells.
    if (values.firstName || values.lastName || values.membershipBirthDate || values.payerEmail || values.username) rows.push({line:r + 1, values});
  }
  if (!rows.length) throw new WorkbookError('Aucune ligne d’adhérent à importer.');
  const links = [];
  const relations = book.Sheets[linkSheet];
  if (relations) {
    if (linkColumns.slice(0, 2).some((label, i) => headerKey(cellText(relations[address(0, i)])) !== headerKey(label))) throw new WorkbookError('En-têtes de l’onglet Responsables invalides.');
    const end = lastRow(relations);
    for (let r = 1; r <= end; r++) {
      const member = cellText(relations[address(r, 0)]);
      const guardian = cellText(relations[address(r, 1)]);
      if (member || guardian) links.push({line:r + 1, member, guardian});
    }
  }
  return {rows, links, hasLinkSheet:!!relations, hasContactCards:active.includes('contactCard')};
}

function writeWorkbook(members, format) {
  const data = [columns.map(column => column?.[1] ?? null)];
  const links = [linkColumns];
  const label = person => [person.firstName, person.lastName].filter(Boolean).join(' ') || person.email || person.phone || person.username;
  for (const member of members) {
    const values = {...member.membershipSheet, ...member, contactCard:member.provider === 'contact' ? 'Oui' : null};
    data.push(columns.map(column => {
      if (!column) return null;
      const value = values[column[0]];
      if (column[0] === 'competition') return member.competition ? 'X' : null;
      if (memberDateFields.includes(column[0]) && /^\d{4}-\d{2}-\d{2}$/.test(value) && value >= '1900-03-01') {
        // Excel stores calendar dates as serials. This also avoids host timezone shifts.
        const serial = (Date.parse(value) - Date.UTC(1899,11,30)) / 86400000;
        return {t:'n', v:serial, z:'dd/mm/yyyy'};
      }
      return value ?? null;
    }));
    for (const guardian of member.guardians) links.push([member.username, guardian.username, label(member), label(guardian)]);
  }
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(data), memberSheet);
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(links), linkSheet);
  return XLSX.write(book, {type:'buffer', bookType:format, compression:true});
}

module.exports = {maxFileBytes, extraColumns, WorkbookError, readWorkbook, writeWorkbook};
