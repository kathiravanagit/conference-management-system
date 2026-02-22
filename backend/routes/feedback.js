const express = require('express');
const router = express.Router();
// Default route for /api/feedback
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Feedback API root. Use /my, /conference/:id, etc.' });
});
const {
  submitFeedback,
  getConferenceFeedback,
  getMyFeedback,
  updateFeedback,
  deleteFeedback,
} = require('../controllers/feedbackController');
const { protect, authorize, require2FAComplete } = require('../middleware/auth');

/**
 * Feedback Routes
 */

// Student routes
router.post('/', protect, require2FAComplete, submitFeedback);
router.get('/my', protect, require2FAComplete, getMyFeedback);
router.put('/:id', protect, require2FAComplete, updateFeedback);
router.delete('/:id', protect, require2FAComplete, deleteFeedback);

// Admin/Public routes
router.get('/conference/:conferenceId', getConferenceFeedback);

module.exports = router;
