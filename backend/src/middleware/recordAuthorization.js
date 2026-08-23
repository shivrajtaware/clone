const { HttpError } = require('../utils/prismaInput');

const deny = (message = 'Record not found') => { throw new HttpError(404, message); };

const requireTenantRecord = async (req, model, id, options = {}) => {
  const { prisma } = require('../config/db');
  if (!req.hospitalId || !id) deny();
  const record = await prisma[model].findFirst({
    where: { id, hospital_id: req.hospitalId },
    ...(options.select ? { select: options.select } : {}),
    ...(options.include ? { include: options.include } : {}),
  });
  if (!record) deny();
  return record;
};

const requirePatient = (req, patientId) => requireTenantRecord(req, 'patient', patientId);

const requirePatientRelation = async (req, model, id, relation = 'patient') => {
  const { prisma } = require('../config/db');
  const record = await prisma[model].findFirst({
    where: { id, [relation]: { hospital_id: req.hospitalId } },
  });
  if (!record) deny();
  return record;
};

module.exports = { requireTenantRecord, requirePatient, requirePatientRelation };
