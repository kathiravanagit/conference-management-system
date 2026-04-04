const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { protect, require2FAComplete } = require('../middleware/auth');

// GET /api/notifications — get my notifications
router.get('/', protect, require2FAComplete, async (req, res) => {
    try {
        const notifications = await Notification.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(30);
        const unreadCount = await Notification.countDocuments({ userId: req.user.id, isRead: false });
        res.json({ success: true, notifications, unreadCount });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/notifications/read-all — mark all as read
router.put('/read-all', protect, require2FAComplete, async (req, res) => {
    try {
        await Notification.updateMany({ userId: req.user.id, isRead: false }, { isRead: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/notifications/:id/read — mark one as read
router.put('/:id/read', protect, require2FAComplete, async (req, res) => {
    try {
        await Notification.findByIdAndUpdate(req.params.id, { isRead: true });
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/notifications/:id — delete one notification
router.delete('/:id', protect, require2FAComplete, async (req, res) => {
    try {
        const removed = await Notification.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id,
        });

        if (!removed) {
            return res.status(404).json({ success: false, message: 'Notification not found' });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
