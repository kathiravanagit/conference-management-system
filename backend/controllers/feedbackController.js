const Feedback = require('../models/Feedback');

/**
 * Submit feedback for conference
 * POST /api/feedback
 */
exports.submitFeedback = async (req, res, next) => {
  try {
    const { conferenceId, rating, comment, categories } = req.body;

    if (!conferenceId || !rating) {
      return res.status(400).json({
        success: false,
        message: 'Please provide conference ID and rating',
      });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: 'Rating must be between 1 and 5',
      });
    }

    // Check if feedback already exists
    const existingFeedback = await Feedback.findOne({
      userId: req.user.id,
      conferenceId,
    });

    if (existingFeedback) {
      return res.status(400).json({
        success: false,
        message: 'You have already submitted feedback for this conference',
      });
    }

    const feedback = await Feedback.create({
      userId: req.user.id,
      conferenceId,
      rating,
      comment,
      categories: categories || {},
    });
        pointsHistory: [
          {
            conferenceId,
            points,
            reason: 'Feedback Submitted',
          },
        ],
      });
    }

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      feedback,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get feedback for conference
 * GET /api/feedback/conference/:conferenceId
 */
exports.getConferenceFeedback = async (req, res, next) => {
  try {
    const feedback = await Feedback.find({ conferenceId: req.params.conferenceId })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    // Calculate analytics
    const total = feedback.length;
    const averageRating = total > 0 ? feedback.reduce((sum, f) => sum + f.rating, 0) / total : 0;

    const categoryAverages = {};
    if (total > 0) {
      ['speakerQuality', 'contentRelevance', 'timeManagement', 'venueExperience'].forEach((cat) => {
        const ratings = feedback
          .filter((f) => f.categories[cat])
          .map((f) => f.categories[cat]);
        categoryAverages[cat] = ratings.length > 0 ? ratings.reduce((a, b) => a + b) / ratings.length : 0;
      });
    }

    res.status(200).json({
      success: true,
      count: total,
      analytics: {
        averageRating,
        totalResponses: total,
        categoryAverages,
      },
      feedback,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Get user feedbacks
 * GET /api/feedback/my
 */
exports.getMyFeedback = async (req, res, next) => {
  try {
    const feedback = await Feedback.find({ userId: req.user.id })
      .populate('conferenceId', 'title date')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: feedback.length,
      feedback,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Update feedback
 * PUT /api/feedback/:id
 */
exports.updateFeedback = async (req, res, next) => {
  try {
    let feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found',
      });
    }

    // Check if user owns this feedback
    if (feedback.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    feedback = await Feedback.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(200).json({
      success: true,
      feedback,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};

/**
 * Delete feedback
 * DELETE /api/feedback/:id
 */
exports.deleteFeedback = async (req, res, next) => {
  try {
    const feedback = await Feedback.findById(req.params.id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found',
      });
    }

    // Check if user owns this feedback
    if (feedback.userId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized',
      });
    }

    await Feedback.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Feedback deleted successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: error.message,
    });
  }
};
