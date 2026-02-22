const qrcode = require('qrcode');
const path = require('path');

/**
 * Generate QR Code for Attendance
 */
exports.generateQRCode = async (registrationId, ticketNumber) => {
  try {
    const uploadsDir = path.join(__dirname, '../uploads');
    const filename = `qr-${ticketNumber}-${Date.now()}.png`;
    const filepath = path.join(uploadsDir, filename);

    const qrData = JSON.stringify({
      registrationId: registrationId,
      ticketNumber: ticketNumber,
      timestamp: Date.now(),
    });

    await qrcode.toFile(filepath, qrData, {
      errorCorrectionLevel: 'H',
      type: 'image/png',
      width: 300,
      margin: 2,
    });

    return `/uploads/${filename}`;
  } catch (error) {
    console.error('Error generating QR code:', error);
    throw error;
  }
};

/**
 * Verify QR Code
 */
exports.verifyQRCode = async (imagePath) => {
  try {
    const jsQR = require('jsqr');
    // This is a mock implementation
    // In production, use: npm install jsqr
    return true;
  } catch (error) {
    console.error('Error verifying QR code:', error);
    return false;
  }
};
