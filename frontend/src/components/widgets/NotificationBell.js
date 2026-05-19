import React, { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { FaBell, FaTimes } from 'react-icons/fa';
import './NotificationBell.css';

const API_URL = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL.replace(/\/$/, '')
  : '/api';

const NotificationBell = () => {
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unread, setUnread] = useState(0);
    const ref = useRef(null);

    const fetchNotifications = useCallback(async () => {
        try {
            const res = await axios.get(`${API_URL}/notifications`);
            setNotifications(res.data.notifications || []);
            setUnread(res.data.unreadCount || 0);
        } catch (_) { }
    }, []);

    useEffect(() => {
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 30000); // poll every 30s
        return () => clearInterval(interval);
    }, [fetchNotifications]);

    useEffect(() => {
        const handleOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handleOutside);
        return () => document.removeEventListener('mousedown', handleOutside);
    }, []);

    const handleOpen = async () => {
        setOpen((prev) => !prev);
        if (!open && unread > 0) {
            try {
                await axios.put(`${API_URL}/notifications/read-all`);
                setUnread(0);
                setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
            } catch (_) { }
        }
    };

    const handleDeleteNotification = async (notificationId) => {
        try {
            const target = notifications.find((n) => n._id === notificationId);
            await axios.delete(`${API_URL}/notifications/${notificationId}`);
            setNotifications((prev) => prev.filter((n) => n._id !== notificationId));
            if (target && !target.isRead) {
                setUnread((prev) => Math.max(0, prev - 1));
            }
        } catch (_) { }
    };

    const timeAgo = (date) => {
        const diff = (Date.now() - new Date(date)) / 1000;
        if (diff < 60) return 'just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    };

    return (
        <div className="notif-bell-wrap" ref={ref}>
            <button className="notif-bell-btn" onClick={handleOpen} aria-label="Notifications">
                <FaBell className="notif-bell-icon" />
                {unread > 0 && (
                    <span className="notif-badge">{unread > 9 ? '9+' : unread}</span>
                )}
            </button>

            {open && (
                <div className="notif-dropdown">
                    <div className="notif-header">
                        <span>Notifications</span>
                        {unread === 0 && <span className="notif-all-read">All read</span>}
                    </div>
                    <div className="notif-list">
                        {notifications.length === 0 ? (
                            <p className="notif-empty">No notifications yet.</p>
                        ) : (
                            notifications.map((n) => (
                                <div
                                    key={n._id}
                                    className={`notif-item ${n.isRead ? '' : 'notif-unread'}`}
                                >
                                    <div className="notif-item-top">
                                        <p className="notif-title">{n.title}</p>
                                        <button
                                            type="button"
                                            className="notif-remove-btn"
                                            onClick={() => handleDeleteNotification(n._id)}
                                            aria-label="Remove notification"
                                            title="Remove"
                                        >
                                            <FaTimes />
                                        </button>
                                    </div>
                                    <p className="notif-msg">{n.message}</p>
                                    <span className="notif-time">{timeAgo(n.createdAt)}</span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
