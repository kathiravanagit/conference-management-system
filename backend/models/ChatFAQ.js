const mongoose = require('mongoose');

/**
 * ChatFAQ Model
 * Stores Q&A pairs for the virtual assistant.
 * Questions are matched using keyword overlap scoring.
 */
const chatFAQSchema = new mongoose.Schema(
    {
        question: {
            type: String,
            required: true,
            trim: true,
        },
        answer: {
            type: String,
            required: true,
        },
        // Normalised keywords extracted from the question for fast matching
        keywords: {
            type: [String],
            default: [],
        },
        category: {
            type: String,
            enum: ['general', 'registration', 'conference', 'certificate', 'meeting', 'leaderboard', 'account', 'staff'],
            default: 'general',
        },
        // How many times this FAQ was matched/served
        hitCount: {
            type: Number,
            default: 0,
        },
        // Source of the FAQ: 'seed' (pre-built) or 'user' (asked by a real user and answered)
        source: {
            type: String,
            enum: ['seed', 'user'],
            default: 'seed',
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model('ChatFAQ', chatFAQSchema);
