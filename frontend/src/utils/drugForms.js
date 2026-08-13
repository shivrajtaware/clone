export const DRUG_FORMS = ['Tablet', 'Capsule', 'Syrup', 'Suspension', 'Drops', 'Injection', 'Ampoule', 'Vial', 'Infusion', 'IV Fluid', 'Inhaler', 'Nebule', 'Ointment', 'Cream', 'Gel', 'Lotion', 'Powder', 'Sachet', 'Suppository', 'Patch', 'Spray', 'Device', 'Surgical', 'Consumable', 'Bottle', 'Pack', 'Other']
export const DRUG_ROUTES = ['Oral', 'IV', 'IM', 'SC', 'Sublingual', 'Topical', 'Inhaled', 'Nebulized', 'Rectal', 'Ophthalmic', 'Otic', 'Nasal']

export const normalizeDrugText = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
export const normalizedDrugForm = (v) => normalizeDrugText(v).split(' ')[0]
export const isStripLikeUnit = (v) => ['strip', 'strips', 'packet', 'pack', 'box'].includes(normalizeDrugText(v))

export const inferredLooseUnit = (item = {}) => {
  item = item || {}
  const rawUnit = String(item.unit || '').trim()
  const rawPack = String(item.pack_unit || '').trim()
  const form = normalizedDrugForm(item.form)
  if (rawUnit && normalizeDrugText(rawUnit) !== normalizeDrugText(rawPack) && !isStripLikeUnit(rawUnit)) return rawUnit
  if (form === 'tablet') return 'tablet'
  if (form === 'capsule') return 'capsule'
  if (['syrup', 'suspension', 'drops'].includes(form)) return 'ml'
  if (['injection', 'ampoule'].includes(form)) return normalizeDrugText(item.strength).includes('ml') ? 'ampoule' : 'vial'
  if (['vial'].includes(form)) return 'vial'
  if (['infusion', 'iv'].includes(form)) return 'bottle'
  if (['inhaler', 'nebule'].includes(form)) return form === 'inhaler' ? 'dose' : 'nebule'
  if (['ointment', 'cream', 'gel', 'lotion'].includes(form)) return 'tube'
  if (form === 'patch') return 'patch'
  if (form === 'spray') return 'spray'
  if (form === 'sachet') return 'sachet'
  return rawUnit || 'unit'
}

export const inferredPackUnit = (item = {}) => {
  item = item || {}
  const pack = String(item.pack_unit || '').trim()
  if (pack) return pack
  return ['tablet', 'capsule'].includes(normalizedDrugForm(item.form)) ? 'strip' : 'container'
}

export const packSize = (item) => {
  const size = Math.max(0.000001, Number(item?.units_per_pack || 1))
  if (size > 1) return size
  if (['tablet', 'capsule'].includes(normalizedDrugForm(item?.form)) && isStripLikeUnit(item?.unit || item?.pack_unit)) return 10
  return size
}

export const stockText = (qty, item) => {
  const total = Number(qty || 0)
  const size = packSize(item)
  return size > 1 ? `${Math.floor(total / size)} ${inferredPackUnit(item)} + ${total % size} ${inferredLooseUnit(item)}` : `${total} ${inferredLooseUnit(item)}`
}

export const baseQty = (qty, unit, item) => Number.parseInt(qty || 1, 10) * (unit === 'PACK' ? packSize(item) : 1)
