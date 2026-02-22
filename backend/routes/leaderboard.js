const express = require('express');
const router = express.Router();
const {
  getLeaderboard,
  getUserLeaderboardPosition,
  getDepartmentLeaderboard,
  getMyLeaderboard,
} = require('../controllers/leaderboardController');
const { protect, require2FAComplete } = require('../middleware/auth');

/**
 * Leaderboard Routes
 */

// Public routes
router.get('/', getLeaderboard);
router.get('/department/:department', getDepartmentLeaderboard);

// Protected routes
router.get('/user/:userId', getUserLeaderboardPosition);
router.get('/my', protect, require2FAComplete, getMyLeaderboard);

module.exports = router;
