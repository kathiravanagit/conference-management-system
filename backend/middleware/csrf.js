const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const CSRF_TOKEN_EXPIRY = 60 * 60 * 1000; // 1 hour
const csrfTokenStore = new Map(); // In production, use Redis

/**
 * Custom CSRF Protection Middleware
 * Generates and validates CSRF tokens for state-changing requests
 * Modern approach: token in response header, validated on POST/PUT/DELETE
 */

/**
 * Generate CSRF Token
 * Call on GET requests (especially page loads) to provide CSRF token
 */
exports.generateCSRFToken = (req, res, next) => {
  try {
    // Generate a random token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Store with expiry
    csrfTokenStore.set(token, {
      createdAt: Date.now(),
      userId: req.user?.id || 'anonymous',
    });

    // Set in response header and optionally in a cookie for client-side access
    res.setHeader('X-CSRF-Token', token);
    res.cookie('X-CSRF-Token', token, {
      httpOnly: false, // Client-side JS needs to read this
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: CSRF_TOKEN_EXPIRY,
    });

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to generate CSRF token',
    });
  }
};

/**
 * Validate CSRF Token
 * Verify token on POST/PUT/DELETE requests
 */
exports.validateCSRFToken = (req, res, next) => {
  try {
    // Skip CSRF check for GET requests (idempotent operations)
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Skip for public endpoints (like /api/auth/login, /api/auth/register)
    const publicEndpoints = [
      '/api/auth/login',
      '/api/auth/register',
      '/api/auth/forgot-password',
      '/api/auth/reset-password',
      '/api/auth/confirm-login',
      '/api/auth/google',
    ];

    if (publicEndpoints.includes(req.path)) {
      return next();
    }

    // Get token from header or body
    const token = req.headers['x-csrf-token'] || 
                  req.body?.csrfToken ||
                  req.query?.csrfToken;

    if (!token) {
      return res.status(403).json({
        success: false,
        message: 'CSRF token missing',
      });
    }

    // Validate token exists and hasn't expired
    const tokenData = csrfTokenStore.get(token);
    if (!tokenData) {
      return res.status(403).json({
        success: false,
        message: 'Invalid or expired CSRF token',
      });
    }

    // Check expiry
    if (Date.now() - tokenData.createdAt > CSRF_TOKEN_EXPIRY) {
      csrfTokenStore.delete(token);
      return res.status(403).json({
        success: false,
        message: 'CSRF token expired',
      });
    }

    // Mark token as used (optional: one-time use tokens)
    // csrfTokenStore.delete(token);

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'CSRF validation failed',
    });
  }
};

/**
 * Cleanup expired tokens periodically
 * Run this function every hour
 */
exports.cleanupExpiredTokens = () => {
  setInterval(() => {
    const now = Date.now();
    for (const [token, data] of csrfTokenStore.entries()) {
      if (now - data.createdAt > CSRF_TOKEN_EXPIRY) {
        csrfTokenStore.delete(token);
      }
    }
  }, 60 * 60 * 1000); // Run every hour
};

/**
 * Invalidate CSRF Token (on logout)
 */
exports.invalidateCSRFToken = (req, res, next) => {
  const token = req.headers['x-csrf-token'] || 
                req.cookies['X-CSRF-Token'];
  
  if (token && csrfTokenStore.has(token)) {
    csrfTokenStore.delete(token);
  }

  next();
};
