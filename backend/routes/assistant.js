const express = require('express');
const router = express.Router();
const { ask, getFAQs, getSuggestions } = require('../controllers/assistantController');
const { generateCSRFToken } = require('../middleware/csrf');
const rateLimit = require('express-rate-limit');

// Rate limiter for public assistant usage to avoid abuse
const assistantLimiter = rateLimit({
	windowMs: 60 * 1000, // 1 minute
	max: 10, // allow 10 requests per minute per IP
	message: { success: false, message: 'Too many assistant requests, please try again later.' },
});

// POST /api/assistant/ask — ask a question
router.post('/ask', assistantLimiter, ask);

// GET /api/assistant/suggestions — get popular question suggestions
// Generate a CSRF token on this GET so anonymous clients receive a token
router.get('/suggestions', generateCSRFToken, getSuggestions);

// GET /api/assistant/csrf — explicit endpoint to issue a CSRF token
// Clients can call this to ensure they receive a CSRF cookie/header before POSTing
router.get('/csrf', generateCSRFToken, (req, res) => {
	res.json({ success: true, message: 'CSRF token issued' });
});

// GET /api/assistant/faqs — get all FAQs (for admin inspection)
router.get('/faqs', getFAQs);

module.exports = router;
