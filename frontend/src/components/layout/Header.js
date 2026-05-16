import React, { useEffect, useRef, useState } from 'react';
import {
  FaHome,
  FaCalendar,
  FaTicketAlt,
  FaList,
  FaSignOutAlt,
  FaSignInAlt,
  FaShieldAlt,
  FaUserCircle,
  FaUserEdit,
  FaKey,
  FaBars,
  FaTimes,
  FaSun,
  FaMoon,
  FaUsers,
} from 'react-icons/fa';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import NotificationBell from '../widgets/NotificationBell';
import LogoutModal from '../ui/LogoutModal';
import './Header.css';

const Header = () => {
  const { user, logout, isAuthenticated, canManageEvents } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  const handleLogoutClick = () => {
    setMenuOpen(false); // Close dropdown so it doesn't stay behind the modal
    setShowLogoutModal(true);
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    setMobileOpen(false);
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="header">
      <div className="header-container">
        <Link to="/" className="logo">
          <span className="logo-mark">ConferenceHub</span>
          <span className="logo-subtitle">Academic Events Platform</span>
        </Link>

        <div className="header-right-controls">
          {/* Theme toggle — always visible */}
          <button
            className="theme-toggle"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {theme === 'dark' ? <FaSun /> : <FaMoon />}
            <span>Theme</span>
          </button>

          {/* Notification bell — only when logged in */}
          {isAuthenticated && <NotificationBell />}

          {/* Hamburger toggle */}
          <button
            className="mobile-toggle"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>

        <nav className={`nav-menu ${mobileOpen ? 'nav-open' : ''}`}>
          <Link to="/" className={`nav-link ${isActive('/') ? 'nav-active' : ''}`}>
            <FaHome /> Home
          </Link>
          <Link to="/conferences" className={`nav-link ${isActive('/conferences') ? 'nav-active' : ''}`}>
            <FaCalendar /> Conferences
          </Link>

          {isAuthenticated ? (
            <>
              {!canManageEvents && (
                <>
                  <Link to="/participation" className={`nav-link ${isActive('/participation') ? 'nav-active' : ''}`}>
                    <FaTicketAlt /> Participation
                  </Link>
                  <Link to="/my-registrations" className={`nav-link ${isActive('/my-registrations') ? 'nav-active' : ''}`}>
                    <FaTicketAlt /> My Tickets
                  </Link>
                  <Link to="/meetings" className={`nav-link ${isActive('/meetings') ? 'nav-active' : ''}`}>
                    <FaCalendar /> Meetings
                  </Link>
                </>
              )}

              {canManageEvents && (
                <>
                  <Link to="/meetings" className={`nav-link ${isActive('/meetings') ? 'nav-active' : ''}`}>
                    <FaCalendar /> Meetings
                  </Link>
                  <Link to="/staff/dashboard" className={`nav-link ${isActive('/staff/dashboard') ? 'nav-active' : ''}`}>
                    <FaList /> Staff Dashboard
                  </Link>
                  {user?.role === 'admin' && (
                    <Link to="/admin/users" className={`nav-link ${isActive('/admin/users') ? 'nav-active' : ''}`}>
                      <FaUsers /> Users
                    </Link>
                  )}
                </>
              )}

              {/* Analytics link removed for student UI */}

              <div className="profile-menu" ref={menuRef}>
                <button
                  type="button"
                  className="profile-trigger"
                  onClick={() => setMenuOpen((prev) => !prev)}
                  aria-label="Open profile menu"
                >
                  <FaUserCircle />
                </button>

                {menuOpen && (
                  <div className="profile-dropdown">
                    <div className="profile-summary">
                      <strong>{user?.name}</strong>
                      <span>{user?.email}</span>
                      <span className="profile-role">{user?.role}</span>
                    </div>

                    <Link
                      to="/account/profile"
                      className="profile-item"
                      onClick={() => setMenuOpen(false)}
                    >
                      <FaUserEdit /> Profile
                    </Link>

                    <Link
                      to="/account/password"
                      className="profile-item"
                      onClick={() => setMenuOpen(false)}
                    >
                      <FaKey /> Password
                    </Link>

                    <Link
                      to="/2fa-setup"
                      className="profile-item"
                      onClick={() => setMenuOpen(false)}
                    >
                      <FaShieldAlt /> 2FA: {user?.twoFactorEnabled ? 'Enabled' : 'Disabled'}
                    </Link>

                    <button onClick={handleLogoutClick} className="profile-item logout-item" type="button">
                      <FaSignOutAlt /> Logout
                    </button>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="auth-links">
              <Link to="/login" className="nav-link">
                <FaSignInAlt /> Login
              </Link>
              <Link to="/register" className="nav-link register-btn">
                Register
              </Link>
            </div>
          )}
        </nav>
      </div>

      {/* Modern UI Logout Modal overlay */}
      <LogoutModal
        isOpen={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={confirmLogout}
      />
    </header>
  );
};

export default Header;
