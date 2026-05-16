const express = require('express');
const router = express.Router();
// Default route for /api/qa
router.get('/', (req, res) => {
  res.json({ success: true, message: 'QA API root. Use /:conferenceId, etc.' });
});
const {
  postMessage,
  getConferenceQA,
  likeMessage,
  replyToMessage,
  deleteMessage,
} = require('../controllers/qaController');
const { protect, require2FAComplete } = require('../middleware/auth');
const { qaPostLimiter, qaReplyLimiter } = require('../middleware/rateLimit');
const { validateQAPostPayload, validateQAReplyPayload } = require('../middleware/validation');
const { sanitizeFields } = require('../middleware/sanitize');

/**
 * Q&A Routes
 */

// Public/Protected routes
router.get('/:conferenceId', getConferenceQA);
router.post('/', protect, require2FAComplete, qaPostLimiter, validateQAPostPayload, sanitizeFields('message'), postMessage);

// Protected student routes
router.put('/:id/like', protect, require2FAComplete, likeMessage);
router.post('/:id/reply', protect, require2FAComplete, qaReplyLimiter, validateQAReplyPayload, sanitizeFields('message'), replyToMessage);
router.delete('/:id', protect, require2FAComplete, deleteMessage);

module.exports = router;
