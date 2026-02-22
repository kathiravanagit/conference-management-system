const express = require('express');
const router = express.Router();
// Default route for /api/registrations
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Registrations API root. Use /my, /conference/:id, etc.' });
});
const {
  getMyRegistrations,
  getConferenceRegistrations,
  getRegistrationStats,
  registerForConference,
  cancelRegistration,
} = require('../controllers/registrationController');
const { protect, require2FAComplete, authorize } = require('../middleware/auth');

/**
 * Registration Routes
 */

// Protected routes (for students)
router.get('/my', protect, require2FAComplete, getMyRegistrations);
router.get(
  '/conference/:conferenceId',
  protect,
  require2FAComplete,
  authorize('admin', 'staff'),
  getConferenceRegistrations
);
router.get(
  '/conference/:conferenceId/stats',
  protect,
  require2FAComplete,
  authorize('admin', 'staff'),
  getRegistrationStats
);
router.post('/', protect, require2FAComplete, registerForConference);
router.delete('/:id', protect, require2FAComplete, cancelRegistration);

module.exports = router;
