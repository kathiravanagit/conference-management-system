const mongoose = require('mongoose');

/**
 * QA Chat Schema
 * Stores real-time Q&A messages during conferences using Socket.io
 */
const qaChatSchema = new mongoose.Schema(
  {
    conferenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conference',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    userName: String,
    message: {
      type: String,
      required: true,
      maxlength: 500,
    },
    isQuestion: {
      type: Boolean,
      default: false,
    },
    likes: {
      type: Number,
      default: 0,
    },
    replies: [
      {
        userId: mongoose.Schema.Types.ObjectId,
        userName: String,
        message: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

qaChatSchema.index({ conferenceId: 1, createdAt: -1 });
qaChatSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('QAChat', qaChatSchema);
