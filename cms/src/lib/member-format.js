const {errors} = require('@strapi/utils');
const {fields} = require('./member-profile');

const contactFields = ['firstName','lastName','phone','street','postalCode','city'];
const messages = {
  phone:'Indiquez un téléphone français à 10 chiffres ou un numéro international avec son indicatif.',
  postalCode:'Indiquez un code postal français à 5 chiffres ou renseignez le pays pour une adresse étrangère.',
};

function frenchAddress(country) {
  return !country?.trim() || /^(france|fr|fra)$/i.test(country.trim());
}

function formatPhone(value, country) {
  if (!/^[+\d\s()./-]+$/.test(value)) return null;
  const international = value.replace(/^((?:\+|00)(?:33|44|49|41|32))\s*\(0\)/,'$1');
  const compact = international.replace(/[\s()./-]/g,'').replace(/^00/,'+');
  const national = compact.replace(/^\+330?/, '0');
  if (/^0[1-9]\d{8}$/.test(national) && (compact.startsWith('+33') || frenchAddress(country))) {
    return frenchAddress(country) ? national.match(/../g).join(' ') : '+33'+national.slice(1);
  }
  if (compact.startsWith('+33')) return null;
  if (/^\+[1-9]\d{6,14}$/.test(compact)) return compact;
  return !frenchAddress(country) && /^\d{6,15}$/.test(compact) ? compact : null;
}

function formatField(key, raw, country) {
  if (raw == null) return raw;
  if (typeof raw !== 'string') throw new errors.ValidationError('Valeur de fiche membre invalide.');
  const value = raw.normalize('NFC').trim().replace(/\s+/gu,' ');
  if (!value) return '';
  switch (key) {
    case 'firstName':
      return value.toLocaleLowerCase('fr').replace(/(^|[\s\p{Pd}'’])(\p{L})/gu, (_,prefix,letter)=>prefix+letter.toLocaleUpperCase('fr'));
    case 'lastName':
    case 'city':
      return value.toLocaleUpperCase('fr');
    case 'street':
      return value.replace(/^\p{Ll}/u,letter=>letter.toLocaleUpperCase('fr'));
    case 'phone':
      return formatPhone(value,country);
    case 'postalCode': {
      if (frenchAddress(country)) {
        const digits = value.replace(/ /g,'');
        return /^\d{4,5}$/.test(digits) ? digits.padStart(5,'0') : null;
      }
      const code=value.toUpperCase();
      return /^[A-Z0-9]+(?:[ -][A-Z0-9]+)*$/.test(code) ? code : null;
    }
  }
}

// Keep historical values that cannot be repaired unambiguously. Interactive writes
// reject them, and imports report them against the source line.
function formatChanges(data,country,onInvalid) {
  const changes={};
  for (const key of contactFields) {
    if (data[key]==null) continue;
    const value=formatField(key,data[key],country);
    if (value===null || value.length>fields[key]) {
      onInvalid(key,messages[key] || 'Champ trop long après normalisation.');
    } else if (value!==data[key]) changes[key]=value;
  }
  return changes;
}

module.exports={contactFields,frenchAddress,formatField,formatPhone,formatChanges};
