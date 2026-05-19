const express = require('express');
const router = express.Router();

// WARNING: This route is intended for short-lived debugging only.
// It is enabled only when DEBUG_CSRF=true in the environment.
router.get('/csrf-info', (req, res) => {
  res.json({
    success: true,
    headers: req.headers,
    cookies: req.cookies || {},
    origin: req.get('origin') || null,
    host: req.get('host') || null,
  });
});

module.exports = router;
