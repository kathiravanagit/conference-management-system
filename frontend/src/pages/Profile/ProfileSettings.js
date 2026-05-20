import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ErrorMessage from '../../components/ui/ErrorMessage';
import './AccountSettings.css';

const ProfileSettings = () => {
  const { user, updateProfile, deleteAccount, logout } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Danger Zone state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);

  const twoFactorStatus = useMemo(
    () => (user?.twoFactorEnabled ? 'Enabled' : 'Disabled'),
    [user?.twoFactorEnabled]
  );

  const handleProfileSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await updateProfile({ name, phone });
      setSuccess('Profile updated successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async (event) => {
    event.preventDefault();
    if (!deletePassword) {
      setError('Please enter your password to confirm deletion.');
      return;
    }

    setDeleteLoading(true);
    setError('');
    try {
      await deleteAccount(deletePassword);
      logout();
      navigate('/register', { state: { message: 'Your account has been completely wiped from our servers.' } });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to delete account.');
      setDeleteLoading(false);
    }
  };

  if (!user) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="account-page">
      <div className="account-card">
        <h1>Profile Settings</h1>

        {error && <ErrorMessage message={error} />}
        {success && <p className="account-success">{success}</p>}

        <section className="account-section">
          <h2>Profile Information</h2>
          <form onSubmit={handleProfileSubmit} className="account-form">
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input id="email" type="email" value={user.email || ''} readOnly />
            </div>

            <div className="form-group">
              <label htmlFor="phone">Phone</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="Optional"
              />
            </div>

            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Updating...' : 'Update Profile'}
            </button>
          </form>
        </section>

        <section className="account-section">
          <h2>Two-Factor Status</h2>
          <div className="status-row">
            <span>Status:</span>
            <strong>{twoFactorStatus}</strong>
          </div>
          <Link to="/2fa-setup" className="btn btn-outline account-link-btn">
            Manage Two-Factor Authentication
          </Link>
        </section>

        <section className="account-section danger-zone" style={{ border: '1px solid #ff4d4f', padding: '1.5rem', borderRadius: '10px', marginTop: '2rem' }}>
          <h2 style={{ color: '#ff4d4f', marginTop: 0 }}>Danger Zone</h2>
          <p style={{ color: '#ccc', marginBottom: '1.5rem' }}>
            Permanently delete your account and all associated personal data from this system. <strong>This action cannot be undone.</strong>
          </p>

          {!showDeleteConfirm ? (
            <button
              type="button"
              className="btn"
              style={{ backgroundColor: 'transparent', color: '#ff4d4f', border: '1px solid #ff4d4f' }}
              onClick={() => setShowDeleteConfirm(true)}
            >
              Delete Account
            </button>
          ) : (
            <div style={{ background: 'rgba(255, 77, 79, 0.06)', border: '1px solid rgba(255,77,79,0.25)', borderRadius: '10px', padding: '1.2rem' }}>
              <p style={{ color: '#ff4d4f', fontWeight: 600, marginTop: 0, marginBottom: '0.6rem' }}>
                ⚠ Are you absolutely sure?
              </p>
              <p style={{ color: '#ccc', fontSize: '0.9rem', marginTop: 0, marginBottom: '1rem' }}>
                This will permanently delete your account, registrations, certificates, and all associated data. This <strong>cannot be undone</strong>.
              </p>
              <form onSubmit={handleDeleteAccount} className="account-form" style={{ marginTop: '0.5rem' }}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="deletePassword" style={{ color: '#ff4d4f' }}>Confirm your password</label>
                  <input
                    id="deletePassword"
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder="Enter your password to verify"
                    required
                  />
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <button type="submit" className="btn" style={{ backgroundColor: '#ff4d4f', color: '#fff', flex: 1 }} disabled={deleteLoading}>
                    {deleteLoading ? 'Wiping Data...' : 'Permanently Delete'}
                  </button>
                  <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setError(''); }}>
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default ProfileSettings;
