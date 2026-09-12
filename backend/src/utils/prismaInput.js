const { Prisma } = require('@prisma/client');

const models = new Map(Prisma.dmmf.datamodel.models.map(model => [model.name, model]));
const enums = new Map(Prisma.dmmf.datamodel.enums.map(enm => [enm.name, enm.values.map(v => v.name)]));

const SYSTEM_FIELDS = new Set(['created_at', 'updated_at']);

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

const badRequest = (message) => {
  throw new HttpError(400, message);
};

const isBlank = (value) => (
  value === undefined ||
  value === null ||
  (typeof value === 'string' && value.trim() === '')
);

const cleanString = (value) => (typeof value === 'string' ? value.trim() : value);

const toBoolean = (value, fieldName = 'value') => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  badRequest(`Invalid boolean value for ${fieldName}`);
};

const toInt = (value, fieldName = 'value') => {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) badRequest(`Invalid number for ${fieldName}`);
  return parsed;
};

const toFloat = (value, fieldName = 'value') => {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) badRequest(`Invalid amount for ${fieldName}`);
  return parsed;
};

const toDate = (value, fieldName = 'date') => {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) badRequest(`Invalid date for ${fieldName}`);
    return value;
  }

  const raw = cleanString(value);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T00:00:00.000Z`)
    : new Date(raw);

  if (Number.isNaN(date.getTime())) badRequest(`Invalid date for ${fieldName}`);
  return date;
};

const splitCsv = (value) => {
  if (Array.isArray(value)) return value;
  if (isBlank(value)) return [];
  return String(value)
    .split(',')
    .map(part => part.trim())
    .filter(Boolean);
};

const normalizeEnum = (field, value) => {
  const validValues = enums.get(field.type) || [];
  const normalized = String(value).trim().toUpperCase();
  if (!validValues.includes(normalized)) {
    badRequest(`Invalid ${field.name}. Expected one of: ${validValues.join(', ')}`);
  }
  return normalized;
};

const coerceScalar = (field, value) => {
  if (isBlank(value)) {
    return field.isRequired ? undefined : null;
  }

  if (field.isList) {
    const values = Array.isArray(value) ? value : splitCsv(value);
    return values
      .filter(item => !isBlank(item))
      .map(item => coerceScalar({ ...field, isList: false }, item));
  }

  if (field.kind === 'enum') return normalizeEnum(field, value);

  switch (field.type) {
    case 'String':
      return cleanString(value);
    case 'Int':
      return toInt(value, field.name);
    case 'Float':
    case 'Decimal':
      return toFloat(value, field.name);
    case 'Boolean':
      return toBoolean(value, field.name);
    case 'DateTime':
      return toDate(value, field.name);
    case 'Json':
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    default:
      return value;
  }
};

const getModel = (modelName) => {
  const model = models.get(modelName);
  if (!model) badRequest(`Unknown model ${modelName}`);
  return model;
};

const sanitizeModelInput = (modelName, input = {}, options = {}) => {
  const model = getModel(modelName);
  const exclude = new Set([...(options.exclude || []), ...SYSTEM_FIELDS]);
  const only = options.only ? new Set(options.only) : null;
  const transforms = options.transforms || {};
  const output = {};

  for (const field of model.fields) {
    if (!['scalar', 'enum'].includes(field.kind)) continue;
    if (exclude.has(field.name)) continue;
    if (only && !only.has(field.name)) continue;
    if (!Object.prototype.hasOwnProperty.call(input, field.name)) continue;

    const rawValue = input[field.name];
    const value = transforms[field.name]
      ? transforms[field.name](rawValue, field)
      : coerceScalar(field, rawValue);

    if (value !== undefined) output[field.name] = value;
  }

  return output;
};

const requireFields = (data, fields) => {
  const missing = fields.filter(field => isBlank(data[field]));
  if (missing.length) badRequest(`Missing required field(s): ${missing.join(', ')}`);
};

const findPatientByReference = async (prisma, hospitalId, reference) => {
  const ref = cleanString(reference);
  if (isBlank(ref)) return null;

  const looksLikeUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ref);
  if (looksLikeUuid) {
    const patient = await prisma.patient.findFirst({
      where: { id: ref, hospital_id: hospitalId },
      select: { id: true },
    });
    if (patient) return patient;
  }

  const nameParts = ref.split(/\s+/).filter(Boolean);
  const patients = await prisma.patient.findMany({
    where: {
      hospital_id: hospitalId,
      OR: [
        { uhid: { equals: ref, mode: 'insensitive' } },
        { phone: ref },
        { email: { equals: ref, mode: 'insensitive' } },
        { aadhar_no: ref },
        { first_name: { contains: ref, mode: 'insensitive' } },
        { last_name: { contains: ref, mode: 'insensitive' } },
        ...(nameParts.length >= 2 ? [{
          AND: [
            { first_name: { contains: nameParts[0], mode: 'insensitive' } },
            { last_name: { contains: nameParts.slice(1).join(' '), mode: 'insensitive' } },
          ],
        }] : []),
      ],
    },
    select: { id: true, uhid: true, first_name: true, last_name: true },
    take: 2,
  });

  if (patients.length === 1) return patients[0];
  if (patients.length > 1) badRequest(`More than one patient matched "${ref}". Please use the exact UHID.`);
  return null;
};

const resolvePatientId = async (prisma, hospitalId, reference) => {
  const patient = await findPatientByReference(prisma, hospitalId, reference);
  if (!patient) badRequest(`Patient not found for "${reference}". Enter an exact registered patient name or UHID.`);
  return patient.id;
};

const normalizeAllergies = (allergies, allergiesNote) => {
  const rows = [];

  for (const item of Array.isArray(allergies) ? allergies : []) {
    const source = typeof item === 'string' ? { allergen: item } : item;
    const allergy = sanitizeModelInput('PatientAllergy', source, {
      exclude: ['id', 'patient_id', 'noted_at'],
    });

    if (!isBlank(allergy.allergen)) {
      rows.push({
        type: 'OTHER',
        severity: 'MILD',
        ...allergy,
      });
    }
  }

  for (const allergen of splitCsv(allergiesNote)) {
    rows.push({ allergen, type: 'OTHER', severity: 'MILD' });
  }

  const seen = new Set();
  return rows.filter(row => {
    const key = row.allergen.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeEmergencyContacts = (contacts) => (
  (Array.isArray(contacts) ? contacts : [])
    .map(contact => sanitizeModelInput('EmergencyContact', contact, {
      exclude: ['id', 'patient_id'],
    }))
    .filter(contact => contact.name && contact.relation && contact.phone)
);

const normalizeInsuranceDetails = (details) => (
  (Array.isArray(details) ? details : [])
    .map(detail => sanitizeModelInput('InsuranceDetail', detail, {
      exclude: ['id', 'patient_id'],
    }))
    .filter(detail => detail.provider_name && detail.policy_no)
);

module.exports = {
  HttpError,
  badRequest,
  cleanString,
  isBlank,
  requireFields,
  resolvePatientId,
  sanitizeModelInput,
  splitCsv,
  toBoolean,
  toDate,
  toFloat,
  toInt,
  normalizeAllergies,
  normalizeEmergencyContacts,
  normalizeInsuranceDetails,
};
