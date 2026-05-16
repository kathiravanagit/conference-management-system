const jwt = require('jsonwebtoken');

/**
 * Authentication Middleware
 * Protects routes that require authentication
 */
exports.protect = async (req, res, next) => {
  let token;

  // Try to get token from httpOnly cookie first (secure)
  if (req.cookies?.authToken) {
    token = req.cookies.authToken;
  }
  // Fall back to Authorization header (for tools like Postman, socket.io)
  else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized to access this route',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Token is not valid',
    });
  }
};

/**
 * Admin Authorization Middleware
 * Only allows admin users to access protected routes
 */
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`,
      });
    }
    next();
  };
};

/**
 * Block access if 2FA is pending
 */
exports.require2FAComplete = (req, res, next) => {
  if (req.user?.twoFactorPending) {
    return res.status(403).json({
      success: false,
      message: 'Two-factor verification required',
    });
  }
  next();
};
