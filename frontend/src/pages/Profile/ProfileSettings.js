import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ErrorMessage from '../../components/ui/ErrorMessage';
import './AccountSettings.css';

const ProfileSettings = () => {
  const { user, updateProfile } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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
      </div>
    </div>
  );
};

export default ProfileSettings;
