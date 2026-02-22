const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generate PDF Certificate
 */
exports.generateCertificate = async (userName, conferenceName, certificateNumber, attendanceHours) => {
  return new Promise((resolve, reject) => {
    try {
      const uploadsDir = path.join(__dirname, '../uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filename = `certificate-${certificateNumber}-${Date.now()}.pdf`;
      const filepath = path.join(uploadsDir, filename);
      const doc = new PDFDocument({
        size: 'A4',
        orientation: 'landscape',
      });

      const stream = fs.createWriteStream(filepath);
      doc.pipe(stream);

      // Certificate border
      doc.strokeColor('#D4AF37');
      doc.lineWidth(20);
      doc.rect(20, 20, doc.page.width - 40, doc.page.height - 40).stroke();

      // Inner border
      doc.strokeColor('#333333');
      doc.lineWidth(2);
      doc.rect(40, 40, doc.page.width - 80, doc.page.height - 80).stroke();

      // Certificate title
      doc.fontSize(48);
      doc.fillColor('#D4AF37');
      doc.font('Helvetica-Bold');
      doc.text('CERTIFICATE OF ATTENDANCE', {
        align: 'center',
        y: 100,
      });

      // Decorative line
      doc.strokeColor('#D4AF37');
      doc.lineWidth(2);
      doc.moveTo(100, 150);
      doc.lineTo(doc.page.width - 100, 150);
      doc.stroke();

      // Body text
      doc.fontSize(14);
      doc.fillColor('#333333');
      doc.font('Helvetica');
      doc.text('This is to certify that', {
        align: 'center',
        y: 180,
      });

      // Name
      doc.fontSize(28);
      doc.font('Helvetica-Bold');
      doc.fillColor('#000000');
      doc.text(userName, {
        align: 'center',
        y: 220,
      });

      // Certificate details
      doc.fontSize(14);
      doc.font('Helvetica');
      doc.fillColor('#333333');
      doc.text(`Has successfully attended the conference on`, {
        align: 'center',
        y: 270,
      });

      doc.fontSize(16);
      doc.font('Helvetica-Bold');
      doc.fillColor('#000000');
      doc.text(conferenceName, {
        align: 'center',
        y: 300,
      });

      // Attendance hours
      doc.fontSize(12);
      doc.font('Helvetica');
      doc.fillColor('#333333');
      doc.text(`Duration: ${attendanceHours} hours`, {
        align: 'center',
        y: 350,
      });

      // Certificate number
      doc.text(`Certificate Number: ${certificateNumber}`, {
        align: 'center',
        y: 380,
      });

      // Date
      doc.text(`Date: ${new Date().toLocaleDateString()}`, {
        align: 'center',
        y: 410,
      });

      // Signature area
      doc.fontSize(12);
      doc.text('_________________', {
        align: 'center',
        y: 480,
      });
      doc.text('Authorized Signature', {
        align: 'center',
        y: 510,
      });

      doc.end();

      stream.on('finish', () => {
        resolve(`/uploads/${filename}`);
      });

      stream.on('error', (error) => {
        reject(error);
      });
    } catch (error) {
      reject(error);
    }
  });
};
