const mongoose = require('mongoose');

/**
 * Registration Schema
 * Tracks student registrations for conferences
 */
const registrationSchema = new mongoose.Schema(
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
    status: {
      type: String,
      enum: ['registered', 'attended', 'cancelled', 'waitlisted'],
      default: 'registered',
    },
    attendanceStatus: {
      type: Boolean,
      default: false,
    },
    attendanceTime: {
      type: Date,
      default: null,
    },
    qrCodeScanned: {
      type: Boolean,
      default: false,
    },
    certificateGenerated: {
      type: Boolean,
      default: false,
    },
    ticketNumber: {
      type: String,
      unique: true,
    },
  },
  { timestamps: true }
);

// Compound unique index
registrationSchema.index({ userId: 1, conferenceId: 1 }, { unique: true });

module.exports = mongoose.model('Registration', registrationSchema);
