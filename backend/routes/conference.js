const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const CompletedConference = require('../models/CompletedConference');
const {
  getAllConferences,
  getConference,
  createConference,
  updateConference,
  deleteConference,
  uploadPoster,
  authorizeMeetingJoin,
  uploadRecording,
  getRecordings,
} = require('../controllers/conferenceController');
const { protect, authorize, require2FAComplete } = require('../middleware/auth');
const upload = require('../middleware/upload');
const { validateConferenceCreation, validateMongoId } = require('../middleware/advancedValidation');

const recordingsDir = path.join(process.cwd(), 'uploads', 'recordings');
if (!fs.existsSync(recordingsDir)) {
  fs.mkdirSync(recordingsDir, { recursive: true });
}

const recordingStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, recordingsDir),
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `recording-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

const recordingUpload = multer({
  storage: recordingStorage,
  limits: { fileSize: 1024 * 1024 * 500 },
  fileFilter: (req, file, cb) => {
    const allowed = /webm|mp4|x-matroska/;
    const isMimeAllowed = allowed.test(file.mimetype);
    const isExtAllowed = /\.webm|\.mp4|\.mkv/i.test(path.extname(file.originalname));
    if (isMimeAllowed || isExtAllowed) return cb(null, true);
    return cb(new Error('Only video files (webm/mp4/mkv) are allowed for recordings'));
  },
});

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
router.post('/:id/meeting-auth', protect, authorizeMeetingJoin);
router.get('/:id/recordings', protect, getRecordings);
router.post('/:id/recordings', protect, recordingUpload.single('recording'), uploadRecording);

// Staff/Admin protected routes
router.post('/', protect, require2FAComplete, authorize('admin', 'staff'), validateConferenceCreation, createConference);
router.put('/:id', protect, require2FAComplete, authorize('admin', 'staff'), validateMongoId, updateConference);
router.delete('/:id', protect, require2FAComplete, authorize('admin', 'staff'), validateMongoId, deleteConference);
router.put(
  '/:id/poster',
  protect,
  require2FAComplete,
  authorize('admin', 'staff'),
  upload.single('poster'),
  uploadPoster
);

module.exports = router;
