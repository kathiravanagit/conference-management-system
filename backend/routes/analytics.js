const express = require('express');
const router = express.Router();
const {
  getAnalyticsOverview,
  getAttendanceStats,
  getPopularConferences,
  getAttendanceTrends,
  getCategoryBreakdown,
  getUserParticipationSummary,
} = require('../controllers/analyticsController');

/**
 * Analytics Routes
 */

// Public routes
router.get('/', getAnalyticsOverview);
router.get('/attendance', getAttendanceStats);
router.get('/popular', getPopularConferences);
router.get('/trends', getAttendanceTrends);
router.get('/categories', getCategoryBreakdown);
router.get('/user-participation', getUserParticipationSummary);

module.exports = router;
