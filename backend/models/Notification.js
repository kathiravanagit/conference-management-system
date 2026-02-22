const mongoose = require('mongoose');

/**
 * Notification Schema
 * Stores notifications for users (email, dashboard)
 */
const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    conferenceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conference',
      default: null,
    },
    type: {
      type: String,
      enum: ['registration', 'reminder', 'feedback_request', 'certificate_ready', 'general'],
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    emailSent: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);
