const Conference = require('../models/Conference');
const { generateMeetingLink } = require('../utils/helpers');

/**
 * Derive conference status from actual start/end datetime.
 * - now < date (start) → upcoming
 * - now >= date AND now <= endDate → ongoing
 * - now > endDate → completed
 * - If endDate is missing, falls back to: same day = ongoing, past day = completed
 */
const deriveConferenceStatus = (conference) => {
  if (conference.status === 'cancelled') {
    return 'cancelled';
  }

  const now = new Date();
  const startDate = new Date(conference.date);
  const endDate = conference.endDate ? new Date(conference.endDate) : null;

  if (endDate) {
    // Use precise datetime comparison with start/end
    if (now < startDate) {
      return 'upcoming';
    }
    if (now >= startDate && now <= endDate) {
      return 'ongoing';
    }
    return 'completed';
  }

  // Fallback for old conferences without endDate — day-level comparison
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfConferenceDay = new Date(
    startDate.getFullYear(),
    startDate.getMonth(),
    startDate.getDate()
  );

  if (startOfConferenceDay.getTime() === startOfToday.getTime()) {
    return 'ongoing';
  }

  if (startDate < startOfToday) {
    return 'completed';
  }

  return 'upcoming';
};

/**
 * Get all conferences
 * GET /api/conferences
 * Supports optional query params: status, department
 */
exports.getAllConferences = async (req, res, next) => {
  try {
    const { status, department } = req.query;

    const conferences = await Conference.find({})
      .populate('createdBy', 'name email')
      .sort({ date: 1 });

    // Normalize status based on actual datetime
    const normalizedConferences = conferences.map((conference) => {
      const normalizedStatus = deriveConferenceStatus(conference);
      if (conference.status !== 'cancelled' && conference.status !== normalizedStatus) {
        conference.status = normalizedStatus;
      }
      return conference;
    });

    // Apply client-requested filters
    let filtered = normalizedConferences;

    if (status && status !== 'all') {
      filtered = filtered.filter((c) => c.status === status);
    }

    // Department filter:
    // "ALL" dropdown → show everything
    // Specific dept → show ONLY conferences for that exact department
    if (department && department !== 'ALL') {
      filtered = filtered.filter((c) => c.department === department);
    }

    res.status(200).json({
      success: true,
      count: filtered.length,
      conferences: filtered,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get single conference
 * GET /api/conferences/:id
 */
exports.getConference = async (req, res, next) => {
  try {
    const conference = await Conference.findById(req.params.id).populate('createdBy', 'name email');

    if (!conference) {
      return res.status(404).json({
        success: false,
        message: 'Conference not found',
      });
    }

    // Normalize status
    const normalizedStatus = deriveConferenceStatus(conference);
    if (conference.status !== 'cancelled' && conference.status !== normalizedStatus) {
      conference.status = normalizedStatus;
    }

    res.status(200).json({
      success: true,
      conference,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Create new conference (Staff/Admin)
 * POST /api/conferences
 */
exports.createConference = async (req, res, next) => {
  try {
    const {
      title,
      description,
      date,
      endDate,
      registrationDeadline,
      speaker,
      department,
      maxAttendees,
      schedule,
      meetingLink,
      status,
      enableCertificates,
      enableQA,
    } = req.body;

    if (!title || !description || !date || !endDate || !speaker) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields (title, description, start date, end date, speaker)',
      });
    }

    // Validate endDate > date
    const startDateTime = new Date(date);
    const endDateTime = new Date(endDate);
    if (endDateTime <= startDateTime) {
      return res.status(400).json({
        success: false,
        message: 'End date/time must be after start date/time',
      });
    }

    // Derive status from actual datetime
    const now = new Date();
    let normalizedStatus = 'upcoming';
    if (status && ['upcoming', 'ongoing', 'completed', 'cancelled'].includes(status)) {
      normalizedStatus = status;
    } else if (now >= startDateTime && now <= endDateTime) {
      normalizedStatus = 'ongoing';
    } else if (now > endDateTime) {
      normalizedStatus = 'completed';
    }

    const conference = await Conference.create({
      title,
      description,
      date,
      endDate,
      registrationDeadline: registrationDeadline || null,
      speaker,
      department: department || 'ALL',
      maxAttendees: maxAttendees || 500,
      schedule: schedule || [],
      createdBy: req.user.id,
      status: normalizedStatus,
      enableCertificates: enableCertificates !== undefined ? enableCertificates : false,
      enableQA: enableQA !== undefined ? enableQA : true,
    });

    res.status(201).json({
      success: true,
      conference,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update conference (Staff/Admin)
 * PUT /api/conferences/:id
 */
exports.updateConference = async (req, res, next) => {
  try {
    let conference = await Conference.findById(req.params.id);

    if (!conference) {
      return res.status(404).json({
        success: false,
        message: 'Conference not found',
      });
    }

    // Check if user is the creator or admin
    if (conference.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this conference',
      });
    }

    conference = await Conference.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      conference,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete conference (Staff/Admin)
 * DELETE /api/conferences/:id
 */
exports.deleteConference = async (req, res, next) => {
  try {
    const conference = await Conference.findById(req.params.id);

    if (!conference) {
      return res.status(404).json({ success: false, message: 'Conference not found' });
    }

    // Check if user is the creator or admin
    if (conference.createdBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this conference' });
    }

    // Notify all registered students by email before deleting
    try {
      const { sendCancellationEmail } = require('../utils/email');
      const Registration = require('../models/Registration');
      const User = require('../models/User');
      const registrations = await Registration.find({
        conferenceId: conference._id,
        status: { $in: ['registered', 'waitlisted'] },
      }).populate('userId', 'name email');

      for (const reg of registrations) {
        if (reg.userId?.email) {
          await sendCancellationEmail(reg.userId.email, reg.userId.name, conference.title);
        }
      }
    } catch (notifyErr) {
      console.error('Failed to send cancellation emails:', notifyErr.message);
    }

    // If conference has a Zoho meeting link, attempt to delete the Zoho meeting
    if (conference.meetingLink && conference.meetingLink.includes('zoho.in')) {
      const match = conference.meetingLink.match(/zoho\.in\/meeting\/(.+)$/);
      if (match && match[1]) {
        try {
          await require('axios').delete(`${process.env.INTERNAL_API_URL || 'http://localhost:5000'}/api/meetings/zoho/${match[1]}`);
        } catch (err) {
          console.error('Failed to delete Zoho meeting:', err.message);
        }
      }
    }

    await Conference.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Conference deleted successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Upload conference poster
 * PUT /api/conferences/:id/poster
 */
exports.uploadPoster = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload a file',
      });
    }

    const conference = await Conference.findByIdAndUpdate(
      req.params.id,
      { poster: `/uploads/${req.file.filename}` },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Poster uploaded successfully',
      conference,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

