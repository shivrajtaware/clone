// src/middleware/validation.js
const { body, param, query, validationResult } = require('express-validator');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path || e.param, message: e.msg })),
    });
  }
  next();
};

// Common validators
const validators = {
  // Auth validators
  loginValidator: [
    body('email').isEmail().trim().normalizeEmail(),
    // Passwords are secrets, not HTML. Escaping changes valid passwords such
    // as `A&Bsecure!` before bcrypt compares them.
    body('password').isString().isLength({ min: 8 }),
  ],

  changePasswordValidator: [
    body('currentPassword').isString().notEmpty().isLength({ min: 8 }),
    body('newPassword').isString().isLength({ min: 8 }),
    body('confirmPassword').isString().isLength({ min: 8 }),
  ],

  // Patient validators
  patientValidator: [
    body('first_name').trim().notEmpty().isLength({ min: 2, max: 50 }),
    body('last_name').trim().notEmpty().isLength({ min: 2, max: 50 }),
    body('gender').isIn(['MALE', 'FEMALE', 'OTHER']),
    // Empty optional form controls arrive as ''. Treat them as absent. Accept
    // common Indian formats such as +91 98765 43210 and 09876543210.
    body('phone').optional({ values: 'falsy' }).custom(value => {
      const normalized = String(value).replace(/[\s().-]/g, '');
      return /^\+?[0-9]{7,15}$/.test(normalized);
    }).withMessage('Phone must contain 7 to 15 digits'),
    body('email').optional({ values: 'falsy' }).isEmail().normalizeEmail(),
  ],

  // ID validator
  idValidator: param('id').isUUID(),

  // Pagination validators
  paginationValidator: [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],

  // Search validator
  searchValidator: query('q').trim().notEmpty().isLength({ min: 2, max: 100 }),
};

module.exports = { validate, validators };
