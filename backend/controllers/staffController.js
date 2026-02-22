const Conference = require('../models/Conference');
const Registration = require('../models/Registration');
const Certificate = require('../models/Certificate');
const QAChat = require('../models/QAChat');
const Leaderboard = require('../models/Leaderboard');

/**
 * Derive conference status from actual start/end datetime.
 */
const deriveConferenceStatus = (conference) => {
  if (conference.status === 'cancelled') {
    return 'cancelled';
  }

  const now = new Date();
  const startDate = new Date(conference.date);
  const endDate = conference.endDate ? new Date(conference.endDate) : null;

  if (endDate) {
    if (now < startDate) {
      return 'upcoming';
    }
    if (now >= startDate && now <= endDate) {
      return 'ongoing';
    }
    return 'completed';
  }

  // Fallback for old conferences without endDate
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

exports.getStaffDashboard = async (req, res) => {
  try {
    const conferences = await Conference.find()
      .populate('createdBy', 'name email')
      .sort({ date: -1 })
      .lean();

    const normalizedConferences = conferences.map((conference) => ({
      ...conference,
      status: conference.status === 'cancelled' ? 'cancelled' : deriveConferenceStatus(conference),
    }));

    const ongoingConference =
      normalizedConferences.find((conference) => conference.status === 'ongoing') || null;

    const conferenceIds = normalizedConferences.map((conference) => conference._id);
    const [registrationsCount, certificatesCount, qaCount, topPerformers] = await Promise.all([
      Registration.countDocuments({ conferenceId: { $in: conferenceIds } }),
      Certificate.countDocuments({ conferenceId: { $in: conferenceIds } }),
      QAChat.countDocuments({ conferenceId: { $in: conferenceIds } }),
      Leaderboard.find()
        .populate('userId', 'name email department')
        .sort({ totalPoints: -1 })
        .limit(10)
        .lean(),
    ]);

    const upcomingCount = normalizedConferences.filter((conference) => conference.status === 'upcoming').length;
    const ongoingCount = normalizedConferences.filter((conference) => conference.status === 'ongoing').length;
    const completedCount = normalizedConferences.filter((conference) => conference.status === 'completed').length;

    return res.status(200).json({
      success: true,
      stats: {
        totalConferences: normalizedConferences.length,
        upcomingCount,
        ongoingCount,
        completedCount,
        registrationsCount,
        certificatesCount,
        qaCount,
      },
      ongoingConference,
      topPerformers,
      leaderboard: topPerformers,
      upcomingConferences: normalizedConferences.filter((c) => c.status === 'upcoming'),
      ongoingConferences: normalizedConferences.filter((c) => c.status === 'ongoing'),
      recentConferences: normalizedConferences,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
