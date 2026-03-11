const mongoose = require('mongoose');

/**
 * Conference Schema
 * Stores conference/event details
 */
const conferenceSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Please provide a conference title'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Please provide a description'],
    },
    date: {
      type: Date,
      required: [true, 'Please provide a start date/time'],
    },
    endDate: {
      type: Date,
    },
    registrationDeadline: {
      type: Date,
      default: null,
    },
    speaker: {
      name: { type: String, required: true },
      designation: String,
      email: String,
      bio: String,
      linkedin: String,
    },
    department: {
      type: String,
      enum: ['CSE', 'ECE', 'MECH', 'AIML', 'EEE', 'FT', 'IT', 'ALL'],
      default: 'ALL',
    },
    poster: {
      type: String,
      default: null,
    },
    schedule: [
      {
        time: String,
        activity: String,
      },
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    maxAttendees: {
      type: Number,
      default: 50,
    },
    status: {
      type: String,
      enum: ['upcoming', 'ongoing', 'completed', 'cancelled'],
      default: 'upcoming',
    },
    attendeeCount: {
      type: Number,
      default: 0,
    },
    enableCertificates: {
      type: Boolean,
      default: false,
    },
    enableQA: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Conference', conferenceSchema);
