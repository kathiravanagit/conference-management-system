const multer = require('multer');
const path = require('path');

/**
 * Configure file upload storage
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const fs = require('fs');
    const path = require('path');
    const uploadPath = path.join(__dirname, '../uploads');
    try {
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      cb(null, uploadPath);
    } catch (err) {
      const os = require('os');
      cb(null, os.tmpdir());
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

/**
 * File filter for images and documents
 */
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only images and PDF allowed.'));
  }
};

/**
 * Multer middleware
 */
const upload = multer({
  storage: storage,
  limits: { fileSize: process.env.MAX_FILE_SIZE || 5242880 }, // 5MB
  fileFilter: fileFilter,
});

module.exports = upload;
