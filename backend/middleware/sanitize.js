const xss = require('xss');

/**
 * XSS Sanitization Middleware
 * Removes potentially malicious scripts and HTML from user inputs
 */

const sanitizeString = (str) => {
  if (typeof str !== 'string') return str;
  // Custom XSS options - allow basic formatting but strip scripts
  return xss(str, {
    whiteList: {},
    stripIgnoredTag: true,
    stripLeakingHtml: true,
    onTagAttr: () => {},
  });
};

const sanitizeObject = (obj) => {
  if (!obj) return obj;
  
  const sanitized = {};
  for (const key in obj) {
    if (typeof obj[key] === 'string') {
      sanitized[key] = sanitizeString(obj[key]);
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      sanitized[key] = sanitizeObject(obj[key]);
    } else {
      sanitized[key] = obj[key];
    }
  }
  return sanitized;
};

/**
 * Middleware to sanitize request body
 */
exports.sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  next();
};

/**
 * Middleware to sanitize specific fields in request body
 * Usage: sanitizeFields('message', 'comment', 'description')
 */
exports.sanitizeFields = (...fields) => {
  return (req, res, next) => {
    if (req.body) {
      fields.forEach((field) => {
        if (typeof req.body[field] === 'string') {
          req.body[field] = sanitizeString(req.body[field]);
        }
      });
    }
    next();
  };
};

/**
 * Utility function to sanitize strings in responses
 */
exports.sanitizeString = sanitizeString;

/**
 * Utility function to sanitize objects
 */
exports.sanitizeObject = sanitizeObject;
