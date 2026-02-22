const Registration = require('../models/Registration');
const Conference = require('../models/Conference');
const Leaderboard = require('../models/Leaderboard');
const { calculatePoints } = require('../utils/helpers');

/**
 * Mark attendance (QR code scan)
 * POST /api/attendance/mark
 */
exports.markAttendance = async (req, res, next) => {
  try {
    const { registrationId, ticketNumber } = req.body;

    if (!registrationId || !ticketNumber) {
      return res.status(400).json({
        success: false,
        message: 'Please provide registration ID and ticket number',
      });
    }

    const registration = await Registration.findById(registrationId);

    if (!registration) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found',
      });
    }

    // Verify ticket number
    if (registration.ticketNumber !== ticketNumber) {
      return res.status(400).json({
        success: false,
        message: 'Invalid ticket number',
      });
    }

    // Check if already marked
    if (registration.qrCodeScanned) {
      return res.status(400).json({
        success: false,
        message: 'Attendance already marked',
      });
    }

    // Mark attendance
    registration.attendanceStatus = true;
    registration.qrCodeScanned = true;
    registration.attendanceTime = new Date();
    registration.status = 'attended';
    await registration.save();

    // Prevent staff (conference creator) from getting points for their own conference
    const conference = await Conference.findById(registration.conferenceId);
    if (conference && registration.userId.toString() !== conference.createdBy.toString()) {
      const points = calculatePoints('attend');
      let leaderboard = await Leaderboard.findOne({ userId: registration.userId });
      if (leaderboard) {
        leaderboard.totalPoints += points;
        leaderboard.conferenceAttended += 1;
        leaderboard.pointsHistory.push({
          conferenceId: registration.conferenceId,
          points,
          reason: 'Conference Attendance',
        });
        await leaderboard.save();
      } else {
        await Leaderboard.create({
          userId: registration.userId,
          totalPoints: points,
          conferenceAttended: 1,
          pointsHistory: [
            {
              conferenceId: registration.conferenceId,
              points,
              reason: 'Conference Attendance',
            },
          ],
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Attendance marked successfully',
      registration,
    });

    // Auto-generate certificate in background if enabled
    try {
      const conference = await Conference.findById(registration.conferenceId).select('enableCertificates title');
      if (conference?.enableCertificates) {
        const Certificate = require('../models/Certificate');
        const existing = await Certificate.findOne({
          userId: registration.userId,
          conferenceId: registration.conferenceId,
        });

        if (!existing) {
          const User = require('../models/User');
          const { generateCertificateNumber } = require('../utils/helpers');
          const { generateCertificate } = require('../utils/certificate');
          const { sendCertificateEmail } = require('../utils/email');

          const user = await User.findById(registration.userId).select('name email');
          const certNum = generateCertificateNumber();
          const certPath = await generateCertificate(user.name, conference.title, certNum, 2);

          await Certificate.create({
            userId: registration.userId,
            conferenceId: registration.conferenceId,
            certificateUrl: certPath,
            certificateNumber: certNum,
            attendanceHours: 2,
          });

          registration.certificateGenerated = true;
          await registration.save();

          await sendCertificateEmail(user.email, user.name, conference.title, certPath);
          console.log(`Auto-certificate generated for ${user.name}`);
        }
      }
    } catch (certErr) {
      console.error('Auto-certificate error:', certErr.message);
    }
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get attendance for specific conference (Admin)
 * GET /api/attendance/conference/:conferenceId
 */
exports.getConferenceAttendance = async (req, res, next) => {
  try {
    const registrations = await Registration.find({ conferenceId: req.params.conferenceId })
      .populate('userId', 'name email department')
      .sort({ attendanceTime: -1 });

    const attended = registrations.filter((r) => r.attendanceStatus).length;
    const notAttended = registrations.length - attended;
    const attendanceRate = registrations.length > 0 ? (attended / registrations.length) * 100 : 0;

    res.status(200).json({
      success: true,
      totalRegistered: registrations.length,
      attended,
      notAttended,
      attendanceRate: attendanceRate.toFixed(2),
      registrations,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get user attendance history
 * GET /api/attendance/my
 */
exports.getMyAttendance = async (req, res, next) => {
  try {
    const registrations = await Registration.find({
      userId: req.user.id,
      attendanceStatus: true,
    })
      .populate('conferenceId', 'title date speaker')
      .sort({ attendanceTime: -1 });

    res.status(200).json({
      success: true,
      count: registrations.length,
      attendance: registrations,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
