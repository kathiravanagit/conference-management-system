const mongoose = require('mongoose');

/**
 * Certificate Schema
 * Stores certificate information for attended conferences
 */
const certificateSchema = new mongoose.Schema(
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
    certificateUrl: {
      type: String,
      required: true,
    },
    certificateNumber: {
      type: String,
      unique: true,
    },
    attendanceHours: {
      type: Number,
      default: 2,
    },
    downloadCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Prevent duplicate certificates for the same user+conference
certificateSchema.index({ userId: 1, conferenceId: 1 }, { unique: true });

module.exports = mongoose.model('Certificate', certificateSchema);
