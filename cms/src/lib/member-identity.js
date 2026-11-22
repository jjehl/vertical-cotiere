const {fields} = require('./member-profile');
const normalize = value => (value || '').normalize('NFKD').replace(/\p{M}/gu, '').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
const nameKey = person => JSON.stringify([normalize(person.lastName), normalize(person.firstName)]);

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const parsed = new Date(value);
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0,10) === value;
}

const emailKey = value => (value || '').trim().toLowerCase();
function phoneKey(value) {
  if (!value || value.length > fields.phone || !/^[+0-9 ()./-]+$/.test(value)) return '';
  const digits = value.replace(/[ ()./-]/g,'').replace(/^(?:\+33|0033)0?/, '0');
  return /^\+?\d{9,15}$/.test(digits) ? digits : '';
}

module.exports = {normalize, nameKey, validDate, emailKey, phoneKey};
