const categories=require('../api/publication/content-types/publication/schema.json').attributes.category.enum;

// Used only for historical data/imports. New editorial input uses the enum's
// strict validation and cannot introduce additional categories.
function normalizeCategory(value) {
  if(categories.includes(value))return value;
  const text=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/\b(competitions?|coupe)\b/.test(text))return 'Compétition';
  if(/\bstages?\b/.test(text))return 'Stage';
  if(/\bcours\b/.test(text))return 'Cours';
  if(/\b(sorties?|falaises?|randonnees?)\b/.test(text))return 'Sortie';
  return 'Vie du club';
}
module.exports={categories,normalizeCategory};
