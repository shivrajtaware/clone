// src/middleware/validation.js
const { body, param, query, validationResult } = require('express-validator');

// Validation middleware
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.param, message: e.msg })),
    });
  }
  next();
};

// Common validators
const validators = {
  // Auth validators
  loginValidator: [
    body('email').isEmail().trim().normalizeEmail(),
    body('password').isLength({ min: 8 }).escape(),
  ],

  changePasswordValidator: [
    body('currentPassword').notEmpty().isLength({ min: 8 }).escape(),
    body('newPassword').isLength({ min: 8 }).escape(),
    body('confirmPassword').isLength({ min: 8 }).escape(),
  ],

  // Patient validators
  patientValidator: [
    body('first_name').trim().notEmpty().isLength({ min: 2, max: 50 }),
    body('last_name').trim().notEmpty().isLength({ min: 2, max: 50 }),
    body('gender').isIn(['MALE', 'FEMALE', 'OTHER']),
    body('phone').optional().isMobilePhone(),
    body('email').optional().isEmail().normalizeEmail(),
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
