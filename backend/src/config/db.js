// src/config/db.js
const { PrismaClient, Prisma } = require('@prisma/client');
const { getTenantId } = require('../utils/requestContext');
const { withTenantWhere, scopeTenantData } = require('../utils/tenantPolicy');

// Every model that owns hospital_id is tenant-scoped. This guard is deliberately
// centralized so a newly added route cannot accidentally query another hospital.
const tenantModels = new Set(
  Prisma.dmmf.datamodel.models
    .filter(model => model.fields.some(field => field.name === 'hospital_id'))
    .map(model => model.name)
);

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

prisma.$use(async (params, next) => {
  const hospitalId = getTenantId();
  if (!hospitalId || !params.model || !tenantModels.has(params.model)) return next(params);

  const args = params.args || {};
  const actionsWithWhere = new Set([
    'findUnique', 'findUniqueOrThrow', 'findFirst', 'findFirstOrThrow', 'findMany',
    'count', 'aggregate', 'groupBy', 'update', 'updateMany', 'delete', 'deleteMany', 'upsert',
  ]);

  if (actionsWithWhere.has(params.action)) {
    args.where = withTenantWhere(args.where, hospitalId);
  } else if (params.action === 'create') {
    args.data = scopeTenantData(args.data, hospitalId);
  } else if (params.action === 'createMany') {
    args.data = Array.isArray(args.data)
      ? args.data.map(row => scopeTenantData(row, hospitalId))
      : scopeTenantData(args.data, hospitalId);
  }

  params.args = args;
  return next(params);
});

module.exports = { prisma };
