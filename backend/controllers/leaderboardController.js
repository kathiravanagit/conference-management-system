const Leaderboard = require('../models/Leaderboard');

/**
 * Get leaderboard
 * GET /api/leaderboard
 */
exports.getLeaderboard = async (req, res, next) => {
  try {
    const { limit = 50, department } = req.query;

    let query = {};
    const leaderboard = await Leaderboard.find(query)
      .populate({
        path: 'userId',
        match: department ? { department } : {},
        select: 'name email department',
      })
      .sort({ totalPoints: -1 })
      .limit(parseInt(limit));

    // Filter out null userId entries (from unmatched populate)
    const filteredLeaderboard = leaderboard.filter((entry) => entry.userId !== null);

    res.status(200).json({
      success: true,
      count: filteredLeaderboard.length,
      leaderboard: filteredLeaderboard,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get user leaderboard position
 * GET /api/leaderboard/user/:userId
 */
exports.getUserLeaderboardPosition = async (req, res, next) => {
  try {
    const userLeaderboard = await Leaderboard.findOne({ userId: req.params.userId }).populate(
      'userId',
      'name email department'
    );

    if (!userLeaderboard) {
      return res.status(404).json({
        success: false,
        message: 'User leaderboard not found',
      });
    }

    // Find position
    const position =
      (await Leaderboard.countDocuments({ totalPoints: { $gt: userLeaderboard.totalPoints } })) + 1;

    res.status(200).json({
      success: true,
      position,
      leaderboard: userLeaderboard,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get department leaderboard
 * GET /api/leaderboard/department/:department
 */
exports.getDepartmentLeaderboard = async (req, res, next) => {
  try {
    const { limit = 50 } = req.query;

    const leaderboard = await Leaderboard.find()
      .populate({
        path: 'userId',
        match: { department: req.params.department },
        select: 'name email department',
      })
      .sort({ totalPoints: -1 })
      .limit(parseInt(limit));

    const filteredLeaderboard = leaderboard.filter((entry) => entry.userId !== null);

    res.status(200).json({
      success: true,
      count: filteredLeaderboard.length,
      leaderboard: filteredLeaderboard,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get my leaderboard info
 * GET /api/leaderboard/my
 */
exports.getMyLeaderboard = async (req, res, next) => {
  try {
    const myLeaderboard = await Leaderboard.findOne({ userId: req.user.id }).populate(
      'userId',
      'name email department'
    );

    if (!myLeaderboard) {
      return res.status(404).json({
        success: false,
        message: 'Leaderboard record not found',
      });
    }

    const position =
      (await Leaderboard.countDocuments({ totalPoints: { $gt: myLeaderboard.totalPoints } })) + 1;

    res.status(200).json({
      success: true,
      position,
      leaderboard: myLeaderboard,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
