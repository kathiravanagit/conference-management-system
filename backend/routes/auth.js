const express = require('express');
const router = express.Router();
// Default route for /api/auth
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Auth API root. Use /login, /register, etc.' });
});
const {
  register,
  login,
  confirmLogin,
  forgotPassword,
  resetPassword,
  setup2FA,
  verify2FASetup,
  verify2FA,
  disable2FA,
  getMe,
  updateProfile,
  changePassword,
} = require('../controllers/authController');
const { protect, require2FAComplete } = require('../middleware/auth');

/**
 * Authentication Routes
 */

// Public routes
router.post('/register', register);
router.post('/login', login);
router.get('/confirm-login', confirmLogin);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/verify-2fa', protect, verify2FA);
router.post('/2fa/setup', protect, require2FAComplete, setup2FA);
router.post('/2fa/verify-setup', protect, require2FAComplete, verify2FASetup);
router.post('/2fa/disable', protect, require2FAComplete, disable2FA);

// Protected routes
router.get('/me', protect, require2FAComplete, getMe);
router.put('/updateprofile', protect, require2FAComplete, updateProfile);
router.put('/change-password', protect, require2FAComplete, changePassword);

module.exports = router;
