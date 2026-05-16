const express = require('express');
const router = express.Router();
const { ask, getFAQs, getSuggestions } = require('../controllers/assistantController');
const { generateCSRFToken } = require('../middleware/csrf');

// POST /api/assistant/ask — ask a question
router.post('/ask', ask);

// GET /api/assistant/suggestions — get popular question suggestions
// Generate a CSRF token on this GET so anonymous clients receive a token
router.get('/suggestions', generateCSRFToken, getSuggestions);

// GET /api/assistant/faqs — get all FAQs (for admin inspection)
router.get('/faqs', getFAQs);

module.exports = router;
