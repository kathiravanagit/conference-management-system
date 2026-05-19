const crypto = require('crypto');

/**
 * Stateless CSRF Protection — Double Submit Cookie Pattern
 *
 * How it works:
 * 1. On login/auth: server generates a random token, sets it as a cookie (readable by JS)
 * 2. Frontend reads the cookie and sends it as 'X-CSRF-Token' header on every POST/PUT/DELETE
 * 3. Server simply checks header value === cookie value (no server-side store needed)
 *
 * Why stateless? The previous in-memory Map was cleared every time Render restarts
 * (every 15 min on free tier), breaking all POST requests after a cold start.
 */

const CSRF_COOKIE_NAME = 'X-CSRF-Token';
const CSRF_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

const publicEndpoints = [
  '/api/auth/login',
  '/api/auth/register',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/auth/confirm-login',
  '/api/auth/google',
  '/api/assistant/ask',
];

/**
 * Generate CSRF Token — call after login/google-auth to set the cookie
 */
exports.generateCSRFToken = (req, res, next) => {
  try {
    const token = crypto.randomBytes(32).toString('hex');

    // Set as a non-httpOnly cookie so the frontend JS can read it
    res.setHeader('X-CSRF-Token', token);
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Must be readable by frontend JS
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
      maxAge: CSRF_COOKIE_MAX_AGE,
    });

    next();
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to generate CSRF token' });
  }
};

/**
 * Validate CSRF Token — stateless double-submit cookie check
 * Just verifies that the header value matches the cookie value.
 * No server-side store needed — survives server restarts.
 */
exports.validateCSRFToken = (req, res, next) => {
  try {
    // Skip safe methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      return next();
    }

    // Skip public auth endpoints
    if (publicEndpoints.includes(req.path)) {
      return next();
    }

    // Skip debug routes in development
    if (process.env.NODE_ENV !== 'production' && req.path?.startsWith('/api/debug')) {
      return next();
    }

    const headerToken = req.headers['x-csrf-token'];
    const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

    // For local development and presentations, bypass strict CSRF to guarantee it works.
    if (process.env.NODE_ENV !== 'production') {
      if (!headerToken || !cookieToken || headerToken !== cookieToken) {
        console.warn(`[Dev Warning] CSRF validation failed on ${req.method} ${req.path}. Allowed in development mode.`);
      }
      return next();
    }

    if (!headerToken) {
      return res.status(403).json({
        success: false,
        message: 'CSRF token missing — please refresh the page and try again.',
      });
    }

    if (!cookieToken) {
      return res.status(403).json({
        success: false,
        message: 'CSRF cookie missing — please log out and log in again.',
      });
    }

    // Stateless check: header must match cookie
    if (headerToken !== cookieToken) {
      return res.status(403).json({
        success: false,
        message: 'CSRF token mismatch — possible CSRF attack blocked.',
      });
    }

    return next();
  } catch (error) {
    return res.status(500).json({ success: false, message: 'CSRF validation failed' });
  }
};

/**
 * Cleanup — no-op now (stateless, no store to clean)
 * Kept for backwards compatibility with server.js call.
 */
exports.cleanupExpiredTokens = () => {
  // No-op: stateless CSRF needs no cleanup
};

/**
 * Invalidate CSRF Token on logout — clear the cookie
 */
exports.invalidateCSRFToken = (req, res, next) => {
  res.clearCookie(CSRF_COOKIE_NAME, {
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
  next();
};
