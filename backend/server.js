// Auto-delete expired conferences (DISABLED)
// require('./autoDeleteConferences')();



// ================== IMPORTS ==================
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIO = require('socket.io');
const axios = require('axios');
require('dotenv').config();

const connectDB = require('./config/database');
const { errorHandler } = require('./middleware/error');
const setupSocketIO = require('./sockets/socketHandler');

// Initialize express app (must be before any app.* usage)
const app = express();






// Create HTTP server
const server = http.createServer(app);

// Initialize Socket.io
const io = socketIO(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
});

// Middleware
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:3000' }));
app.use(express.json());
app.use(express.static('uploads'));

// Connect to MongoDB
connectDB();

// Setup Socket.io
setupSocketIO(io);

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/conferences', require('./routes/conference'));
app.use('/api/registrations', require('./routes/registration'));
app.use('/api/certificates', require('./routes/certificate'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/leaderboard', require('./routes/leaderboard'));
app.use('/api/attendance', require('./routes/attendance'));
app.use('/api/qa', require('./routes/qa'));
app.use('/api/staff', require('./routes/staff'));
app.use('/api/assistant', require('./routes/assistant'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/admin', require('./routes/admin'));



// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({ success: true, message: 'Server is running' });
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
      '/api/leaderboard',
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
  console.log(`MongoDB: ${process.env.MONGO_URI}\n`);
});

module.exports = { app, server, io };
