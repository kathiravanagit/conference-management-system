const express = require('express');
const router = express.Router();
const CompletedConference = require('../models/CompletedConference');
const {
  getAllConferences,
  getConference,
  createConference,
  updateConference,
  deleteConference,
  uploadPoster,
  updateConferenceMeeting,
} = require('../controllers/conferenceController');
const { protect, authorize, require2FAComplete } = require('../middleware/auth');
const upload = require('../middleware/upload');

/**
 * Conference Routes
 */

// Public routes
router.get('/', getAllConferences);

// Route to get completed conferences — filtered by creator if ?createdBy= is given
router.get('/completed', async (req, res) => {
  try {
    const filter = {};
    if (req.query.createdBy) filter.createdBy = req.query.createdBy;
    const completedConferences = await CompletedConference.find(filter).sort({ date: -1 });
    res.status(200).json({ success: true, completedConferences });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/:id', getConference);

// Staff/Admin protected routes
router.post('/', protect, require2FAComplete, authorize('admin', 'staff'), createConference);
router.put('/:id', protect, require2FAComplete, authorize('admin', 'staff'), updateConference);
router.delete('/:id', protect, require2FAComplete, authorize('admin', 'staff'), deleteConference);
router.put(
  '/:id/poster',
  protect,
  require2FAComplete,
  authorize('admin', 'staff'),
  upload.single('poster'),
  uploadPoster
);
router.put('/:id/meeting', protect, require2FAComplete, authorize('admin', 'staff'), updateConferenceMeeting);

module.exports = router;
