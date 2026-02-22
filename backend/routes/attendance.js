const express = require('express');
const router = express.Router();
const {
  markAttendance,
  getConferenceAttendance,
  getMyAttendance,
} = require('../controllers/attendanceController');
const { protect, authorize, require2FAComplete } = require('../middleware/auth');

/**
 * Attendance Routes
 */

// Protected routes
router.post('/mark', protect, require2FAComplete, markAttendance);
router.get('/my', protect, require2FAComplete, getMyAttendance);

// Staff/Admin routes
router.get(
  '/conference/:conferenceId',
  protect,
  require2FAComplete,
  authorize('admin', 'staff'),
  getConferenceAttendance
);

// CSV Export of attendance for a conference
router.get(
  '/conference/:conferenceId/export',
  protect,
  require2FAComplete,
  authorize('admin', 'staff'),
  async (req, res) => {
    try {
      const Registration = require('../models/Registration');
      const Conference = require('../models/Conference');

      const conf = await Conference.findById(req.params.conferenceId).select('title');
      const records = await Registration.find({
        conferenceId: req.params.conferenceId,
        status: { $in: ['registered', 'attended'] },
      }).populate('userId', 'name email department');

      const safeTitle = (conf?.title || 'attendance').replace(/[^a-zA-Z0-9_\-]/g, '_');
      const header = 'Name,Email,Department,Ticket,Status,Attended At';
      const rows = records.map((r) => [
        `"${r.userId?.name || ''}"`,
        `"${r.userId?.email || ''}"`,
        `"${r.userId?.department || ''}"`,
        `"${r.ticketNumber || ''}"`,
        `"${r.status}"`,
        `"${r.attendanceTime ? new Date(r.attendanceTime).toLocaleString() : ''}"`,
      ].join(','));

      const csv = [header, ...rows].join('\r\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}_attendance.csv"`);
      res.status(200).send(csv);
    } catch (err) {
      res.status(500).json({ success: false, message: err.message });
    }
  }
);

module.exports = router;

