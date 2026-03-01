const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Generate JWT Token
 */
exports.generateToken = (id, role, twoFactorPending = false, rememberMe = true) => {
  const expiresIn = rememberMe ? '30d' : '1d';
  return jwt.sign({ id, role, twoFactorPending }, process.env.JWT_SECRET, {
    expiresIn: expiresIn,
  });
};

/**
 * Generate random token for email confirmation
 */
exports.generateRandomToken = () => {
  return crypto.randomBytes(32).toString('hex');
};

/**
 * Hash a token before storing
 */
exports.hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

/**
 * Generate 6-digit OTP for password reset
 */
exports.generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Generate meeting link
 * Mock implementation - in production, integrate with Jitsi or Zoho
 */


/**
 * Generate unique ticket number
 */
exports.generateTicketNumber = () => {
  return 'TICKET-' + Date.now() + '-' + Math.random().toString(36).substring(7).toUpperCase();
};

/**
 * Generate certificate number
 */
exports.generateCertificateNumber = () => {
  return 'CERT-' + Date.now() + '-' + Math.random().toString(36).substring(7).toUpperCase();
};

/**
 * Calculate points for user
 */
exports.calculatePoints = (action) => {
  const pointsMap = {
    register: 10,
    registration: 10,
    attend: 20,
    question: 5,
    feedback: 15,
    certificate: 25,
  };
  return pointsMap[action] || 0;
};
