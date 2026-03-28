const mongoose = require('mongoose');

/**
 * MeetingChat Schema
 * Persists in-meeting chat messages for video sessions.
 */
const meetingChatSchema = new mongoose.Schema(
  {
    conferenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conference',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    userName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    message: {
      type: String,
      required: true,
      trim: true,
      maxlength: 500,
    },
  },
  { timestamps: true }
);

meetingChatSchema.index({ conferenceId: 1, createdAt: -1 });

module.exports = mongoose.model('MeetingChat', meetingChatSchema);
