const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, require2FAComplete, authorize } = require('../middleware/auth');

// GET /api/admin/users — list all users
router.get('/users', protect, require2FAComplete, authorize('admin'), async (req, res) => {
    try {
        const { search, role, department } = req.query;
        const filter = {};
        if (role) filter.role = role;
        if (department) filter.department = department;
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
            ];
        }
        const users = await User.find(filter).select('-password').sort({ createdAt: -1 });
        res.json({ success: true, count: users.length, users });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// PUT /api/admin/users/:id/role — change user role
router.put('/users/:id/role', protect, require2FAComplete, authorize('admin'), async (req, res) => {
    try {
        const { role } = req.body;
        const allowed = ['student', 'staff', 'admin'];
        if (!allowed.includes(role)) {
            return res.status(400).json({ success: false, message: 'Invalid role' });
        }
        const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// DELETE /api/admin/users/:id — delete user
router.delete('/users/:id', protect, require2FAComplete, authorize('admin'), async (req, res) => {
    try {
        if (req.params.id === req.user.id) {
            return res.status(400).json({ success: false, message: 'Cannot delete your own account' });
        }
        await User.findByIdAndDelete(req.params.id);
        res.json({ success: true, message: 'User deleted' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
