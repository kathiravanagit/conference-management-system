const mongoose = require('mongoose');

/**
 * Feedback Schema
 * Stores user feedback and ratings for conferences
 */
const feedbackSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    conferenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conference',
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      maxlength: 1000,
    },
    categories: {
      speakerQuality: {
        type: Number,
        min: 1,
        max: 5,
      },
      contentRelevance: {
        type: Number,
        min: 1,
        max: 5,
      },
      timeManagement: {
        type: Number,
        min: 1,
        max: 5,
      },
      venueExperience: {
        type: Number,
        min: 1,
        max: 5,
      },
    },
  },
  { timestamps: true }
);

// Compound unique index - one feedback per user per conference
feedbackSchema.index({ userId: 1, conferenceId: 1 }, { unique: true });

module.exports = mongoose.model('Feedback', feedbackSchema);
