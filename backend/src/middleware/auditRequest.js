const { prisma } = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

const moduleFromPath = (path = '') => {
  const name = path.split('/').filter(Boolean)[1] || 'SYSTEM';
  return name.replace(/-/g, '_').toUpperCase();
};

module.exports = (req, res, next) => {
  res.on('finish', () => {
    if (!req.user || !req.hospitalId || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return;
    if (req.path === '/api/compliance/audit-logs') return;
    prisma.auditLog.create({
      data: {
        id: uuidv4(),
        hospital_id: req.hospitalId,
        user_id: req.user.id,
        action: `HTTP_${req.method}`,
        module: moduleFromPath(req.path),
        record_id: req.params?.id || null,
        request_id: req.id || null,
        ip_address: req.ip,
        user_agent: req.get('user-agent')?.slice(0, 500) || null,
        new_values: { path: req.path, status_code: res.statusCode },
      },
    }).catch(error => logger.warn('Request audit failed', { error: error.message, requestId: req.id }));
  });
  next();
};
