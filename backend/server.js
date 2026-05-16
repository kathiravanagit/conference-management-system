// Auto-delete expired conferences (DISABLED)
// require('./autoDeleteConferences')();



// ================== IMPORTS ==================
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const axios = require('axios');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const connectDB = require('./config/database');
const { errorHandler } = require('./middleware/error');
const { attachRequestContext, logRequestLifecycle } = require('./middleware/requestContext');
const { securityHeaders } = require('./middleware/securityHeaders');
const setupSocketIO = require('./sockets/socketHandler');
const { socketAuthMiddleware } = require('./sockets/socketAuth');
const { validateCSRFToken, cleanupExpiredTokens } = require('./middleware/csrf');

// Initialize express app (must be before any app.* usage)
const app = express();






// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = socketIO(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Apply Socket.io authentication middleware
io.use(socketAuthMiddleware);

// Middleware
app.disable('x-powered-by');
app.use(cors({ 
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  // Allow CSRF header and cookies for cross-origin requests
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Requested-With', 'Cookie'],
}));
app.use(securityHeaders);
app.use(attachRequestContext);
app.use(logRequestLifecycle);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(express.static('uploads'));
app.use('/uploads', express.static('uploads'));

// Rate limiting middleware
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
  standardHeaders: true,
});

app.use('/api/', generalLimiter);

// CSRF Protection
app.use(validateCSRFToken); // Validate CSRF tokens on state-changing requests
cleanupExpiredTokens(); // Start cleanup routine for expired CSRF tokens

// Connect to MongoDB
connectDB();

// Setup Socket.io
setupSocketIO(io);

// Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/conferences', require('./routes/conference'));
app.use('/api/registrations', require('./routes/registration'));
app.use('/api/certificates', require('./routes/certificate'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/qa', require('./routes/qa'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/assistant', require('./routes/assistant'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));

// Development-only debug routes were removed before deploy



// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    requestId: req.requestId,
  });
});

// API root endpoint
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Conference Management System API',
    endpoints: [
      '/api/health',
      '/api/auth',
      '/api/conferences',
      '/api/registrations',
      '/api/certificates',
      '/api/feedback',
      '/api/analytics',
      '/api/attendance',
      '/api/qa',
      '/api/staff',
    ],
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'Conference Management System API' });
});

// Global error handler
app.use(errorHandler);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`\nServer running on port ${PORT}`);
  console.log(`API Documentation: http://localhost:${PORT}/api`);
  console.log('MongoDB: connected\n');
});

module.exports = { app, server, io };
