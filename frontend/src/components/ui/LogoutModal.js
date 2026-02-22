import React from 'react';
import ReactDOM from 'react-dom';
import { FaSignOutAlt, FaTimes } from 'react-icons/fa';
import './LogoutModal.css';

const LogoutModal = ({ isOpen, onClose, onConfirm }) => {
    if (!isOpen) return null;

    return ReactDOM.createPortal(
        <div className="logout-modal-overlay">
            <div className="logout-modal-content">
                <button className="logout-modal-close" onClick={onClose} aria-label="Close modal">
                    <FaTimes />
                </button>

                <div className="logout-modal-header">
                    <div className="logout-icon-wrapper">
                        <FaSignOutAlt />
                    </div>
                    <h2>Confirm Logout</h2>
                </div>

                <p className="logout-modal-body">
                    Are you sure you want to log out of your account? You will need to sign in again to access the dashboard and your registered conferences.
                </p>

                <div className="logout-modal-actions">
                    <button className="btn-cancel" onClick={onClose}>
                        Cancel
                    </button>
                    <button className="btn-confirm-logout" onClick={onConfirm}>
                        Yes, Log Me Out
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default LogoutModal;
