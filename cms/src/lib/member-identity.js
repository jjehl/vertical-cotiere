const {fields} = require('./member-profile');
const {formatField,formatPhone} = require('./member-format');
const normalize = value => (value || '').normalize('NFKD').replace(/\p{M}/gu, '').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ');
const nameKey = person => JSON.stringify([normalize(formatField('lastName',person.lastName)), normalize(person.firstName)]);

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000-')) return false;
  const parsed = new Date(value);
  return Number.isFinite(+parsed) && parsed.toISOString().slice(0,10) === value;
}

const emailKey = value => (value || '').trim().toLowerCase();
function phoneKey(value) {
  if (!value || value.length > fields.phone) return '';
  const phone = formatPhone(value,'international');
  return phone ? phone.replace(/ /g,'').replace(/^\+33/,'0') : '';
}

module.exports = {normalize, nameKey, validDate, emailKey, phoneKey};
