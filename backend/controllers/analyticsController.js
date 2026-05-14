const Conference = require('../models/Conference');
const Registration = require('../models/Registration');
const User = require('../models/User');

/**
 * Get conference analytics overview
 * GET /api/analytics
 */
exports.getAnalyticsOverview = async (req, res, next) => {
  try {
    const { timeframe = '30' } = req.query;
    const daysAgo = parseInt(timeframe);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysAgo);

    const totalConferences = await Conference.countDocuments();
    const recentConferences = await Conference.countDocuments({
      createdAt: { $gte: startDate },
    });
    const totalRegistrations = await Registration.countDocuments();
    const recentRegistrations = await Registration.countDocuments({
      createdAt: { $gte: startDate },
    });
    const totalAttendees = await User.countDocuments({ role: 'participant' });

    res.status(200).json({
      success: true,
      analytics: {
        totalConferences,
        recentConferences,
        totalRegistrations,
        recentRegistrations,
        totalAttendees,
        timeframe: `${daysAgo} days`,
      },
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get attendance statistics
 * GET /api/analytics/attendance
 */
exports.getAttendanceStats = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    // Get conferences with attendance data
    const conferences = await Conference.find()
      .select('title attendees startDate registrationCount')
      .sort({ startDate: -1 })
      .limit(parseInt(limit));

    const attendanceData = await Promise.all(
      conferences.map(async (conf) => {
        const registrations = await Registration.countDocuments({
          conferenceId: conf._id,
        });
        const attendanceRate = registrations > 0 ? (conf.attendees / registrations) * 100 : 0;

        return {
          conferenceId: conf._id,
          title: conf.title,
          totalAttendees: conf.attendees,
          registrations,
          attendanceRate: attendanceRate.toFixed(2),
          startDate: conf.startDate,
        };
      })
    );

    res.status(200).json({
      success: true,
      count: attendanceData.length,
      data: attendanceData,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get popular conferences
 * GET /api/analytics/popular
 */
exports.getPopularConferences = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const popularConferences = await Conference.find()
      .select('title attendees registrationCount startDate category')
      .sort({ attendees: -1 })
      .limit(parseInt(limit));

    res.status(200).json({
      success: true,
      count: popularConferences.length,
      data: popularConferences,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get attendance trends over time
 * GET /api/analytics/trends
 */
exports.getAttendanceTrends = async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const trends = await Conference.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' },
          },
          totalConferences: { $sum: 1 },
          totalAttendees: { $sum: '$attendees' },
          avgAttendees: { $avg: '$attendees' },
        },
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 },
      },
    ]);

    res.status(200).json({
      success: true,
      timeframe: `${days} days`,
      data: trends,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get category breakdown
 * GET /api/analytics/categories
 */
exports.getCategoryBreakdown = async (req, res, next) => {
  try {
    const categoryStats = await Conference.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          totalAttendees: { $sum: '$attendees' },
          avgAttendees: { $avg: '$attendees' },
        },
      },
      {
        $sort: { totalAttendees: -1 },
      },
    ]);

    res.status(200).json({
      success: true,
      data: categoryStats,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get user participation summary
 * GET /api/analytics/user-participation
 */
exports.getUserParticipationSummary = async (req, res, next) => {
  try {
    const { limit = 10 } = req.query;

    const participationStats = await User.aggregate([
      {
        $match: { role: 'participant' },
      },
      {
        $lookup: {
          from: 'registrations',
          localField: '_id',
          foreignField: 'userId',
          as: 'registrations',
        },
      },
      {
        $project: {
          name: 1,
          email: 1,
          registrationCount: { $size: '$registrations' },
        },
      },
      {
        $sort: { registrationCount: -1 },
      },
      {
        $limit: parseInt(limit),
      },
    ]);

    res.status(200).json({
      success: true,
      count: participationStats.length,
      data: participationStats,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
