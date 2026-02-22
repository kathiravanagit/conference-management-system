const express = require('express');
const router = express.Router();
const { ask, getFAQs, getSuggestions } = require('../controllers/assistantController');

// POST /api/assistant/ask — ask a question
router.post('/ask', ask);

// GET /api/assistant/suggestions — get popular question suggestions
router.get('/suggestions', getSuggestions);

// GET /api/assistant/faqs — get all FAQs (for admin inspection)
router.get('/faqs', getFAQs);

module.exports = router;
