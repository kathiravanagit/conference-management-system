const QAChat = require('../models/QAChat');
const Leaderboard = require('../models/Leaderboard');
const { calculatePoints } = require('../utils/helpers');

/**
 * Post question/message in Q&A
 * POST /api/qa/post
 */
exports.postMessage = async (req, res, next) => {
  try {
    const { conferenceId, message, isQuestion } = req.body;

    if (!conferenceId || !message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide conference ID and message',
      });
    }

    const qAChat = await QAChat.create({
      conferenceId,
      userId: req.user.id,
      message,
      isQuestion: isQuestion || false,
    });

    // Add points if posted question
    if (isQuestion) {
      const points = calculatePoints('question');
      let leaderboard = await Leaderboard.findOne({ userId: req.user.id });

      if (leaderboard) {
        leaderboard.totalPoints += points;
        leaderboard.questionsAsked += 1;
        leaderboard.pointsHistory.push({
          conferenceId,
          points,
          reason: 'Question Asked',
        });
        await leaderboard.save();
      }
    }

    res.status(201).json({
      success: true,
      message: 'Message posted successfully',
      qAChat,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get Q&A messages for conference
 * GET /api/qa/:conferenceId
 */
exports.getConferenceQA = async (req, res, next) => {
  try {
    const { type = 'all' } = req.query;

    let query = { conferenceId: req.params.conferenceId };
    if (type === 'questions') {
      query.isQuestion = true;
    }

    const messages = await QAChat.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: messages.length,
      messages,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Like a message
 * PUT /api/qa/:id/like
 */
exports.likeMessage = async (req, res, next) => {
  try {
    const qAChat = await QAChat.findByIdAndUpdate(
      req.params.id,
      { $inc: { likes: 1 } },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Message liked successfully',
      qAChat,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Reply to a message
 * POST /api/qa/:id/reply
 */
exports.replyToMessage = async (req, res, next) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a reply message',
      });
    }

    const qAChat = await QAChat.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          replies: {
            userId: req.user.id,
            message,
          },
        },
      },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: 'Reply posted successfully',
      qAChat,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete Q&A message
 * DELETE /api/qa/:id
 */
exports.deleteMessage = async (req, res, next) => {
  try {
    const qAChat = await QAChat.findById(req.params.id);

    if (!qAChat) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    // Check if user owns this message
    if (
      qAChat.userId.toString() !== req.user.id &&
      !['admin', 'staff'].includes(req.user.role)
    ) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    await QAChat.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
