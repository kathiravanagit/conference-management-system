const express = require('express');
const router = express.Router();
// Default route for /api/certificates
router.get('/', (req, res) => {
  res.json({ success: true, message: 'Certificates API root. Use /my, /generate/:registrationId, etc.' });
});
const {
  generateCertificate,
  getMyCertificates,
  downloadCertificate,
  getAllCertificates,
  uploadCertificate,
} = require('../controllers/certificateController');
const { protect, authorize, require2FAComplete } = require('../middleware/auth');
const upload = require('../middleware/upload');

/**
 * Certificate Routes
 */

// Protected routes (for students)
router.get('/my', protect, require2FAComplete, getMyCertificates);
router.get('/:id/download', protect, require2FAComplete, downloadCertificate);
router.post('/generate/:registrationId', protect, require2FAComplete, generateCertificate);
router.post(
  '/upload',
  protect,
  require2FAComplete,
  authorize('admin', 'staff'),
  upload.single('certificate'),
  uploadCertificate
);

// Staff/Admin routes
router.get('/', protect, require2FAComplete, authorize('admin', 'staff'), getAllCertificates);

module.exports = router;
