const Registration = require('../models/Registration');
const Conference = require('../models/Conference');
const User = require('../models/User');
const Leaderboard = require('../models/Leaderboard');
const Notification = require('../models/Notification');
const mongoose = require('mongoose');
const { generateTicketNumber, calculatePoints } = require('../utils/helpers');
const { sendRegistrationEmail, sendWaitlistPromotionEmail } = require('../utils/email');

// Get my registrations
const getMyRegistrations = async (req, res, next) => {
  try {
    const registrations = await Registration.find({ userId: req.user.id })
      .populate('conferenceId', 'title date speaker department maxAttendees status meetingLink endDate')
      .populate('userId', 'name email department')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: registrations.length,
      registrations
    });
  } catch (error) {
    next(error);
  }
};

// Get all registrations for a conference (admin only)
const getConferenceRegistrations = async (req, res, next) => {
  try {
    const registrations = await Registration.find({ conferenceId: req.params.conferenceId })
      .populate('userId', 'name email department')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: registrations.length,
      data: registrations
    });
  } catch (error) {
    next(error);
  }
};

// Register for conference
const registerForConference = async (req, res, next) => {
  try {
    const { conferenceId } = req.body;

    // Check if conference exists
    const conference = await Conference.findById(conferenceId);
    if (!conference) {
      return res.status(404).json({ success: false, message: 'Conference not found' });
    }

    // Check registration deadline
    if (conference.registrationDeadline && new Date() > new Date(conference.registrationDeadline)) {
      return res.status(400).json({
        success: false,
        message: `Registration closed. Deadline was ${new Date(conference.registrationDeadline).toLocaleString()}.`,
      });
    }

    // Check if conference is cancelled or completed
    if (conference.status === 'cancelled') {
      return res.status(400).json({ success: false, message: 'This conference has been cancelled.' });
    }

    // Check if already registered
    const existingRegistration = await Registration.findOne({ userId: req.user.id, conferenceId });
    if (existingRegistration) {
      return res.status(409).json({ success: false, message: 'Already registered for this conference' });
    }

    // Count confirmed (non-cancelled, non-waitlisted) registrations
    const confirmedCount = await Registration.countDocuments({
      conferenceId,
      status: { $in: ['registered', 'attended'] },
    });

    const isFull = confirmedCount >= conference.maxAttendees;
    const ticketNumber = generateTicketNumber();

    const registration = await Registration.create({
      userId: req.user.id,
      conferenceId,
      ticketNumber,
      status: isFull ? 'waitlisted' : 'registered',
    });

    if (!isFull) {
      // Award points for registration
      await Leaderboard.findOneAndUpdate(
        { userId: req.user.id },
        { $inc: { totalPoints: calculatePoints('registration') } },
        { upsert: true, new: true }
      );
    }

    // Send confirmation email
    const user = await User.findById(req.user.id);
    await sendRegistrationEmail(user.email, user.name, conference.title, conference.date);

    // Create notification
    await Notification.create({
      userId: req.user.id,
      type: 'registration',
      title: isFull ? 'Added to Waitlist' : 'Registration Confirmed',
      message: isFull
        ? `You have been added to the waitlist for ${conference.title}. You will be notified if a slot opens.`
        : `You have registered for ${conference.title}`,
      relatedId: conferenceId,
      read: false,
    });

    res.status(201).json({
      success: true,
      message: isFull
        ? 'Conference is full — you have been added to the waitlist.'
        : 'Successfully registered for conference',
      waitlisted: isFull,
      data: registration,
    });
  } catch (error) {
    next(error);
  }
};

// Cancel registration + auto-promote waitlisted student
const cancelRegistration = async (req, res, next) => {
  try {
    const { id } = req.params;

    const registration = await Registration.findById(id).populate('conferenceId', 'title maxAttendees');
    if (!registration) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }

    // Check ownership
    if (registration.userId.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this registration' });
    }

    // Check if already attended
    if (registration.status === 'attended') {
      return res.status(400).json({ success: false, message: 'Cannot cancel attended conference' });
    }

    const wasRegistered = registration.status === 'registered';
    registration.status = 'cancelled';
    registration.cancellationDate = new Date();
    await registration.save();

    // Deduct points if was confirmed
    if (wasRegistered) {
      await Leaderboard.findOneAndUpdate(
        { userId: req.user.id },
        { $inc: { totalPoints: -calculatePoints('registration') } }
      );

      // Auto-promote first waitlisted student
      const nextInLine = await Registration.findOne({
        conferenceId: registration.conferenceId._id,
        status: 'waitlisted',
      })
        .sort({ createdAt: 1 })
        .populate('userId', 'name email');

      if (nextInLine) {
        nextInLine.status = 'registered';
        await nextInLine.save();
        // Award points to newly promoted student
        await Leaderboard.findOneAndUpdate(
          { userId: nextInLine.userId._id },
          { $inc: { totalPoints: calculatePoints('registration') } },
          { upsert: true }
        );
        // Notify them by email
        await sendWaitlistPromotionEmail(
          nextInLine.userId.email,
          nextInLine.userId.name,
          registration.conferenceId.title
        );
        // In-app notification
        await Notification.create({
          userId: nextInLine.userId._id,
          type: 'registration',
          title: 'Waitlist — Spot Confirmed!',
          message: `A spot opened up for ${registration.conferenceId.title}. You are now registered!`,
          relatedId: registration.conferenceId._id,
          read: false,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Registration cancelled successfully',
      data: registration,
    });
  } catch (error) {
    next(error);
  }
};

// Get registration statistics
const getRegistrationStats = async (req, res, next) => {
  try {
    const { conferenceId } = req.params;

    const stats = await Registration.aggregate([
      { $match: { conferenceId: new mongoose.Types.ObjectId(conferenceId) } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          registered: { $sum: { $cond: [{ $eq: ['$status', 'registered'] }, 1, 0] } },
          attended: { $sum: { $cond: [{ $eq: ['$status', 'attended'] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: stats[0] || {
        total: 0,
        registered: 0,
        attended: 0,
        cancelled: 0
      }
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyRegistrations,
  getConferenceRegistrations,
  registerForConference,
  cancelRegistration,
  getRegistrationStats
};
