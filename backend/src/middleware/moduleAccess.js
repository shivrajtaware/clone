const { getAllowedModules } = require('../utils/modulePermissions');
const { prisma } = require('../config/db');

const moduleAccess = (moduleKey) => async (req, res, next) => {
  if (!req.user || req.user.role === 'SUPER_ADMIN' || req.user.role === 'HOSPITAL_ADMIN') return next();

  const modules = await getAllowedModules(prisma, req.user);
  if (modules.includes(moduleKey)) return next();

  return res.status(403).json({
    success: false,
    message: `Your role does not have access to ${moduleKey.replace(/_/g, ' ')}.`,
  });
};

module.exports = moduleAccess;
