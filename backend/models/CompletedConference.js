const mongoose = require('mongoose');

const completedConferenceSchema = new mongoose.Schema({
  originalId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    ref: 'Conference',
  },
  title: String,
  description: String,
  date: Date,
  endDate: Date,
  speaker: {
    name: String,
    designation: String,
    email: String,
    bio: String,
  },
  meetingLink: String,
  department: String,
  poster: String,
  schedule: Array,
  maxAttendees: Number,
  attendeeCount: Number,
  status: {
    type: String,
    default: 'completed',
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  createdAt: Date,
});

module.exports = mongoose.model('CompletedConference', completedConferenceSchema);
