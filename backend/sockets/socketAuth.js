const jwt = require('jsonwebtoken');

/**
 * Socket.io Authentication Middleware
 * Verifies JWT token from socket handshake query/headers before allowing connections
 */

exports.socketAuthMiddleware = (socket, next) => {
  try {
    // Try to get token from multiple sources:
    // 1. Authorization header (Bearer token)
    // 2. Query parameter (for when headers aren't available)
    // 3. Cookie (if httpOnly is being used)
    const token =
      extractTokenFromHeader(socket.handshake.headers?.authorization) ||
      socket.handshake.auth?.token ||
      socket.handshake.query?.token ||
      extractTokenFromCookie(socket.handshake.headers?.cookie);

    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    // Verify the token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Attach user info to socket data for later use
    socket.data.user = decoded;
    socket.data.userId = decoded.id;
    socket.data.userRole = decoded.role;

    next();
  } catch (error) {
    next(new Error(`Authentication error: ${error.message}`));
  }
};

/**
 * Extract JWT token from Authorization header
 */
function extractTokenFromHeader(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') return null;
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}

/**
 * Extract JWT token from cookies (for httpOnly cookies)
 */
function extractTokenFromCookie(cookieHeader) {
  if (!cookieHeader || typeof cookieHeader !== 'string') return null;
  
  const cookies = cookieHeader.split(';').map(c => c.trim());
  const authCookie = cookies.find(c => c.startsWith('authToken='));
  
  if (authCookie) {
    return authCookie.slice(10); // Remove 'authToken='
  }
  return null;
}

/**
 * Middleware to check if user is authenticated for a specific room
 * Call this in socket event handlers that require auth
 */
exports.requireSocketAuth = (socket, roomId) => {
  if (!socket.data.userId) {
    socket.emit('auth-error', { message: 'User not authenticated' });
    return false;
  }
  return true;
};

/**
 * Middleware to check if user is host or admin for a room
 */
exports.requireHostOrAdmin = (socket, roomState) => {
  if (!socket.data.userRole) {
    return false;
  }

  const isAdmin = socket.data.userRole === 'admin';
  const isHost = roomState?.hostId === socket.data.userId;

  if (!isAdmin && !isHost) {
    socket.emit('auth-error', { message: 'Only host or admin can perform this action' });
    return false;
  }
  return true;
};
