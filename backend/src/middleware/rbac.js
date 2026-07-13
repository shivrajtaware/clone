// src/middleware/rbac.js
const rbac = (...allowedRoles) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'Not authenticated' });
  if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ success: false, message: `Access denied. Required: ${allowedRoles.join(' or ')}` });
  }
  next();
};
module.exports = rbac;

// ─────────────────────────────────────────────────────────────
// src/middleware/errorHandler.js
