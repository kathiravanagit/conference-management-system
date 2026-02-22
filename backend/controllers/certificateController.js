const Certificate = require('../models/Certificate');
const Registration = require('../models/Registration');
const Conference = require('../models/Conference');
const User = require('../models/User');
const Leaderboard = require('../models/Leaderboard');
const { generateCertificateNumber, calculatePoints } = require('../utils/helpers');
const { generateCertificate } = require('../utils/certificate');
const { sendCertificateEmail } = require('../utils/email');

/**
 * Generate certificate for user after attendance
 * POST /api/certificates/generate/:registrationId
 */
exports.generateCertificate = async (req, res, next) => {
  try {
    const registration = await Registration.findById(req.params.registrationId)
      .populate('userId', 'name email')
      .populate('conferenceId', 'title');

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found',
      });
    }

    if (
      ['student', 'it'].includes(req.user.role) &&
      registration.userId._id.toString() !== req.user.id
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to generate this certificate',
      });
    }

    // Check if user attended
    if (!registration.attendanceStatus) {
      return res.status(400).json({
        success: false,
        message: 'User did not attend the conference',
      });
    }

    // Check if certificate already exists
    const existingCert = await Certificate.findOne({
      userId: registration.userId._id,
      conferenceId: registration.conferenceId._id,
    });

    if (existingCert) {
      return res.status(400).json({
        success: false,
        message: 'Certificate already generated',
      });
    }

    const certificateNumber = generateCertificateNumber();
    const certificatePath = await generateCertificate(
      registration.userId.name,
      registration.conferenceId.title,
      certificateNumber,
      2
    );

    const certificate = await Certificate.create({
      userId: registration.userId._id,
      conferenceId: registration.conferenceId._id,
      certificateUrl: certificatePath,
      certificateNumber,
      attendanceHours: 2,
    });

    // Update registration
    registration.certificateGenerated = true;
    await registration.save();

    // Add points to leaderboard
    const points = calculatePoints('certificate');
    let leaderboard = await Leaderboard.findOne({ userId: registration.userId._id });

    if (leaderboard) {
      leaderboard.totalPoints += points;
      leaderboard.certificatesEarned += 1;
      leaderboard.pointsHistory.push({
        conferenceId: registration.conferenceId._id,
        points,
        reason: 'Certificate Earned',
      });
      await leaderboard.save();
    } else {
      await Leaderboard.create({
        userId: registration.userId._id,
        totalPoints: points,
        certificatesEarned: 1,
        pointsHistory: [
          {
            conferenceId: registration.conferenceId._id,
            points,
            reason: 'Certificate Earned',
          },
        ],
      });
    }

    // Send email
    await sendCertificateEmail(
      registration.userId.email,
      registration.userId.name,
      registration.conferenceId.title,
      certificatePath
    );

    res.status(201).json({
      success: true,
      message: 'Certificate generated successfully',
      certificate,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get user certificates
 * GET /api/certificates/my
 */
exports.getMyCertificates = async (req, res, next) => {
  try {
    const certificates = await Certificate.find({ userId: req.user.id })
      .populate('conferenceId', 'title date')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: certificates.length,
      certificates,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Download certificate
 * GET /api/certificates/:id/download
 */
exports.downloadCertificate = async (req, res, next) => {
  try {
    const certificate = await Certificate.findById(req.params.id);

    if (!certificate) {
      return res.status(404).json({
        success: false,
        message: 'Certificate not found',
      });
    }

    // Check authorization
    if (
      certificate.userId.toString() !== req.user.id &&
      !['admin', 'staff'].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    // Update download count
    certificate.downloadCount += 1;
    await certificate.save();

    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '../' + certificate.certificateUrl);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Certificate file not found',
      });
    }

    res.download(filePath);
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get all certificates (Admin only)
 * GET /api/certificates
 */
exports.getAllCertificates = async (req, res, next) => {
  try {
    const certificates = await Certificate.find()
      .populate('userId', 'name email')
      .populate('conferenceId', 'title date')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: certificates.length,
      certificates,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Upload a certificate PDF for a user conference (Staff/Admin)
 * POST /api/certificates/upload
 */
exports.uploadCertificate = async (req, res, next) => {
  try {
    const { userId, conferenceId, attendanceHours = 2 } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a certificate PDF file',
      });
    }

    if (!userId || !conferenceId) {
      return res.status(400).json({
        success: false,
        message: 'userId and conferenceId are required',
      });
    }

    const user = await User.findById(userId).select('name email');
    const conference = await Conference.findById(conferenceId).select('title');

    if (!user || !conference) {
      return res.status(404).json({
        success: false,
        message: 'User or conference not found',
      });
    }

    const existingCertificate = await Certificate.findOne({ userId, conferenceId });
    if (existingCertificate) {
      return res.status(409).json({
        success: false,
        message: 'Certificate already exists for this user and conference',
      });
    }

    const certificateNumber = generateCertificateNumber();
    const certificateUrl = `uploads/${req.file.filename}`;

    const certificate = await Certificate.create({
      userId,
      conferenceId,
      certificateUrl,
      certificateNumber,
      attendanceHours,
    });

    await Registration.findOneAndUpdate(
      { userId, conferenceId },
      { certificateGenerated: true },
      { new: true }
    );

    const points = calculatePoints('certificate');
    let leaderboard = await Leaderboard.findOne({ userId });

    if (leaderboard) {
      leaderboard.totalPoints += points;
      leaderboard.certificatesEarned += 1;
      leaderboard.pointsHistory.push({
        conferenceId,
        points,
        reason: 'Certificate Uploaded',
      });
      await leaderboard.save();
    } else {
      await Leaderboard.create({
        userId,
        totalPoints: points,
        certificatesEarned: 1,
        pointsHistory: [
          {
            conferenceId,
            points,
            reason: 'Certificate Uploaded',
          },
        ],
      });
    }

    await sendCertificateEmail(user.email, user.name, conference.title, `/${certificateUrl}`);

    return res.status(201).json({
      success: true,
      message: 'Certificate uploaded successfully',
      certificate,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
