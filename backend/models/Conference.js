const mongoose = require('mongoose');

const generateMeetingId = () => `MTG-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

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
    meetingId: {
      type: String,
      unique: true,
      index: true,
      default: generateMeetingId,
    },
    meetingPasswordHash: {
      type: String,
      default: null,
      select: false,
    },
    meetingPasswordEnabled: {
      type: Boolean,
      default: false,
    },
    allowParticipantScreenShare: {
      type: Boolean,
      default: true,
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

conferenceSchema.pre('save', function assignMeetingId(next) {
  if (!this.meetingId) {
    this.meetingId = generateMeetingId();
  }
  next();
});

module.exports = mongoose.model('Conference', conferenceSchema);
