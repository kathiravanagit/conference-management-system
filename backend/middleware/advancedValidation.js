const { body, query, param, validationResult } = require('express-validator');

/**
 * Validation Error Handler Middleware
 * Checks validation results and returns errors if any
 */
exports.handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
      })),
    });
  }
  next();
};

/**
 * Validation Rules
 */

// Auth validations
exports.validateRegisterPayload = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 50 }).withMessage('Name must be between 2 and 50 characters'),
  
  body('email')
    .trim()
    .isEmail().withMessage('Valid email is required')
    .normalizeEmail(),
  
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain an uppercase letter')
    .matches(/[a-z]/).withMessage('Password must contain a lowercase letter')
    .matches(/[0-9]/).withMessage('Password must contain a number')
    .matches(/[!@#$%^&*]/).withMessage('Password must contain a special character (!@#$%^&*)'),
  
  body('department')
    .trim()
    .notEmpty().withMessage('Department is required'),
  
  exports.handleValidationErrors,
];

exports.validateLoginPayload = [
  body('email')
    .trim()
    .isEmail().withMessage('Valid email is required'),
  
  body('password')
    .notEmpty().withMessage('Password is required'),
  
  exports.handleValidationErrors,
];

// Conference validations
exports.validateConferenceCreation = [
  body('title')
    .trim()
    .notEmpty().withMessage('Conference title is required')
    .isLength({ min: 3, max: 200 }).withMessage('Title must be between 3 and 200 characters'),
  
  body('description')
    .trim()
    .notEmpty().withMessage('Description is required')
    .isLength({ min: 10, max: 5000 }).withMessage('Description must be between 10 and 5000 characters'),
  
  body('startTime')
    .notEmpty().withMessage('Start time is required')
    .isISO8601().withMessage('Start time must be a valid date'),
  
  body('endTime')
    .notEmpty().withMessage('End time is required')
    .isISO8601().withMessage('End time must be a valid date'),
  
  body('capacity')
    .isInt({ min: 1, max: 5000 }).withMessage('Capacity must be a number between 1 and 5000'),
  
  exports.handleValidationErrors,
];

// QA validations
exports.validateQAPostPayload = [
  body('conferenceId')
    .notEmpty().withMessage('Conference ID is required'),
  
  body('message')
    .trim()
    .notEmpty().withMessage('Message is required')
    .isLength({ min: 3, max: 500 }).withMessage('Message must be between 3 and 500 characters'),
  
  exports.handleValidationErrors,
];

exports.validateQAReplyPayload = [
  body('message')
    .trim()
    .notEmpty().withMessage('Reply message is required')
    .isLength({ min: 3, max: 500 }).withMessage('Message must be between 3 and 500 characters'),
  
  exports.handleValidationErrors,
];

// Feedback validations
exports.validateFeedbackPayload = [
  body('conferenceId')
    .notEmpty().withMessage('Conference ID is required'),
  
  body('title')
    .trim()
    .notEmpty().withMessage('Feedback title is required')
    .isLength({ min: 3, max: 200 }).withMessage('Title must be between 3 and 200 characters'),
  
  body('feedback')
    .trim()
    .notEmpty().withMessage('Feedback text is required')
    .isLength({ min: 10, max: 2000 }).withMessage('Feedback must be between 10 and 2000 characters'),
  
  body('rating')
    .isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  
  exports.handleValidationErrors,
];

// ID validations
exports.validateMongoId = [
  param('id')
    .matches(/^[0-9a-fA-F]{24}$/).withMessage('Invalid ID format'),
];

// Email validation
exports.validateForgotPasswordPayload = [
  body('email')
    .trim()
    .isEmail().withMessage('Valid email is required'),
  
  exports.handleValidationErrors,
];
