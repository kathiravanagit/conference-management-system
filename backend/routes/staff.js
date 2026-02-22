const express = require('express');
const router = express.Router();
// Default route for /api/staff
router.get('/', (req, res) => {
	res.json({ success: true, message: 'Staff API root. Use /dashboard, etc.' });
});
const { getStaffDashboard } = require('../controllers/staffController');
const { protect, require2FAComplete, authorize } = require('../middleware/auth');

router.get('/dashboard', protect, require2FAComplete, authorize('admin', 'staff'), getStaffDashboard);

module.exports = router;
