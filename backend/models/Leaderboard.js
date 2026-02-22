const mongoose = require('mongoose');

/**
 * Leaderboard Schema
 * Tracks user points for participating in conferences
 */
const leaderboardSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    totalPoints: {
      type: Number,
      default: 0,
    },
    conferenceAttended: {
      type: Number,
      default: 0,
    },
    questionsAsked: {
      type: Number,
      default: 0,
    },
    certificatesEarned: {
      type: Number,
      default: 0,
    },
    feedbackSubmitted: {
      type: Number,
      default: 0,
    },
    pointsHistory: [
      {
        conferenceId: mongoose.Schema.Types.ObjectId,
        points: Number,
        reason: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Leaderboard', leaderboardSchema);
