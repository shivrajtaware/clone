const DRUG_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Drops', 'Injection', 'Ampoule', 'Vial', 'Infusion', 'IV Fluid', 'Inhaler', 'Nebule', 'Ointment', 'Cream', 'Gel', 'Lotion', 'Powder', 'Sachet', 'Suppository', 'Patch', 'Spray', 'Device', 'Surgical', 'Consumable', 'Bottle', 'Pack', 'Other'];
const DRUG_ROUTES = ['Oral', 'IV', 'IM', 'SC', 'Sublingual', 'Topical', 'Inhaled', 'Nebulized', 'Rectal', 'Ophthalmic', 'Otic', 'Nasal'];

const normalizeDrugText = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const normalizedDrugForm = (v) => normalizeDrugText(v).split(' ')[0];
const isStripLikeUnit = (v) => ['strip', 'strips', 'packet', 'pack', 'box'].includes(normalizeDrugText(v));

const inferredLooseUnit = (item = {}) => {
  const rawUnit = String(item.unit || '').trim();
  const rawPack = String(item.pack_unit || '').trim();
  const form = normalizedDrugForm(item.form);
  if (rawUnit && normalizeDrugText(rawUnit) !== normalizeDrugText(rawPack) && !isStripLikeUnit(rawUnit)) return rawUnit;
  if (form === 'tablet') return 'tablet';
  if (form === 'capsule') return 'capsule';
  if (['syrup', 'suspension', 'drops'].includes(form)) return 'ml';
  if (['injection', 'ampoule'].includes(form)) return normalizeDrugText(item.strength).includes('ml') ? 'ampoule' : 'vial';
  if (form === 'vial') return 'vial';
  if (['infusion', 'iv'].includes(form)) return 'bottle';
  if (['inhaler', 'nebule'].includes(form)) return form === 'inhaler' ? 'dose' : 'nebule';
  if (['ointment', 'cream', 'gel', 'lotion'].includes(form)) return 'tube';
  if (form === 'patch') return 'patch';
  if (form === 'spray') return 'spray';
  if (form === 'sachet') return 'sachet';
  return rawUnit || 'unit';
};

const inferredPackUnit = (item = {}) => {
  const pack = String(item.pack_unit || '').trim();
  if (pack) return pack;
  return ['tablet', 'capsule'].includes(normalizedDrugForm(item.form)) ? 'strip' : 'container';
};

const packSize = (item) => {
  const size = Math.max(1, Number(item?.units_per_pack || 1));
  if (size > 1) return size;
  if (['tablet', 'capsule'].includes(normalizedDrugForm(item?.form)) && isStripLikeUnit(item?.unit || item?.pack_unit)) return 10;
  return size;
};

module.exports = { DRUG_FORMS, DRUG_ROUTES, normalizeDrugText, normalizedDrugForm, inferredLooseUnit, inferredPackUnit, packSize };
