import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import ErrorMessage from '../../components/ui/ErrorMessage';
import EyeIcon from '../../components/ui/EyeIcon';
import './Auth.css';

const API_URL = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL.replace(/\/$/, '')
  : '/api';

const TwoFactorSetup = () => {
  const [step, setStep] = useState(1); // 1: Not setup, 2: Setup QR, 3: Backup codes, 4: Already enabled
  const [qrCode, setQrCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);

  // Disable 2FA modal state
  const [showDisableModal, setShowDisableModal] = useState(false);
  const [disablePassword, setDisablePassword] = useState('');
  const [disableTOTP, setDisableTOTP] = useState('');
  const [showDisablePassword, setShowDisablePassword] = useState(false);
  const [disableLoading, setDisableLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    checkTwoFactorStatus();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const checkTwoFactorStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/auth/me`);
      const enabled = response.data.user?.twoFactorEnabled || false;
      setTwoFactorEnabled(enabled);
      if (enabled) {
        setStep(4);
      }
    } catch (err) {
      console.error('Error checking 2FA status:', err);
    }
  };

  const handleSetup2FA = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.post(`${API_URL}/auth/2fa/setup`);
      const nextQrCode = response.data?.data?.qrCode;
      if (!nextQrCode) {
        setError('Failed to load QR code. Please try again.');
        return;
      }
      setQrCode(nextQrCode);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to setup 2FA');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FASetup = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError('Please enter a 6-digit verification code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const response = await axios.post(`${API_URL}/auth/2fa/verify-setup`, {
        token: verificationCode,
      });
      const nextBackupCodes = response.data?.data?.backupCodes || [];
      setBackupCodes(nextBackupCodes);
      setTwoFactorEnabled(true);
      if (refreshUser) {
        await refreshUser();
      }
      setStep(3);
      setSuccess('2FA Setup complete! Save your backup codes in a safe place.');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async (e) => {
    e.preventDefault();
    if (!disablePassword) {
      setError('Please enter your current password.');
      return;
    }
    if (!disableTOTP || disableTOTP.length !== 6) {
      setError('Please enter your current 6-digit authenticator code.');
      return;
    }

    try {
      setDisableLoading(true);
      setError('');
      await axios.post(`${API_URL}/auth/2fa/disable`, {
        password: disablePassword,
        token: disableTOTP,
      });
      setTwoFactorEnabled(false);
      setShowDisableModal(false);
      setDisablePassword('');
      setDisableTOTP('');
      if (refreshUser) {
        await refreshUser();
      }
      setStep(1);
      setSuccess('2FA disabled successfully.');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to disable 2FA');
    } finally {
      setDisableLoading(false);
    }
  };

  const copyBackupCode = (code, index) => {
    navigator.clipboard.writeText(code).then(() => {
      setCopiedCode(index);
      setTimeout(() => setCopiedCode(null), 2000);
    });
  };

  const downloadBackupCodes = () => {
    const content = [
      'ConferenceHub — 2FA Backup Codes',
      `Generated: ${new Date().toLocaleString()}`,
      '',
      'Keep these codes safe. Each code can only be used once.',
      '',
      ...backupCodes.map((c, i) => `${i + 1}. ${c}`),
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'conferencehub-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const getTargetDashboard = () => {
    if (['staff', 'it', 'admin'].includes(user?.role)) return '/staff/dashboard';
    return '/dashboard';
  };

  if (!user) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Two-Factor Authentication</h2>

        {error && <ErrorMessage message={error} onClose={() => setError('')} />}
        {success && (
          <div
            className="info-message"
            style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', borderColor: 'rgba(34, 197, 94, 0.2)' }}
          >
            {success}
          </div>
        )}

        {/* Step 1 — Not Enabled */}
        {!twoFactorEnabled && step === 1 && (
          <div>
            <p style={{ marginBottom: '20px', lineHeight: 1.7 }}>
              Two-Factor Authentication adds an extra layer of security to your account.
              You'll need to enter a code from an authenticator app in addition to your password when logging in.
            </p>
            <button
              onClick={handleSetup2FA}
              disabled={loading}
              className="btn"
              style={{ width: '100%' }}
            >
              {loading ? 'Setting up...' : 'Enable 2FA'}
            </button>
          </div>
        )}

        {/* Step 2 — QR Code */}
        {step === 2 && qrCode && (
          <div>
            <h3>Step 1: Scan QR Code</h3>
            <p>
              Scan this QR code with your authenticator app (Google Authenticator, Microsoft Authenticator, Authy, etc.)
            </p>
            <div style={{ textAlign: 'center', margin: '20px 0' }}>
              <img
                src={qrCode}
                alt="2FA QR Code"
                style={{
                  width: '220px',
                  height: '220px',
                  border: '2px solid var(--brand-500)',
                  padding: '10px',
                  background: '#fff',
                  borderRadius: '10px',
                }}
              />
            </div>
            <div className="form-group">
              <label>Enter 6-digit verification code:</label>
              <input
                type="text"
                inputMode="numeric"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength="6"
                disabled={loading}
                style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '6px' }}
              />
            </div>
            <button
              onClick={handleVerify2FASetup}
              disabled={loading || verificationCode.length !== 6}
              className="btn"
              style={{ width: '100%' }}
            >
              {loading ? 'Verifying...' : 'Verify & Enable'}
            </button>
          </div>
        )}

        {/* Step 3 — Backup Codes */}
        {step === 3 && (
          <div>
            <h3>Step 2: Save Backup Codes</h3>
            <p>
              Save these backup codes in a safe place. You can use them to access your account if you lose your authenticator device.
              <strong> Each code can only be used once.</strong>
            </p>
            <div
              style={{
                background: 'var(--surface-200)',
                padding: '15px',
                borderRadius: '10px',
                marginBottom: '15px',
                maxHeight: '220px',
                overflowY: 'auto',
                border: '1px solid var(--card-border)',
              }}
            >
              {backupCodes.map((code, index) => (
                <div
                  key={index}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 4px',
                    borderBottom: index < backupCodes.length - 1 ? '1px solid var(--divider)' : 'none',
                    fontFamily: 'monospace',
                    color: 'var(--ink-900)',
                    fontSize: '1rem',
                  }}
                >
                  <span>{code}</span>
                  <button
                    onClick={() => copyBackupCode(code, index)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: copiedCode === index ? '#22c55e' : 'var(--brand-700)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      minWidth: '50px',
                      transition: 'color 0.2s',
                    }}
                  >
                    {copiedCode === index ? '✓ Copied' : 'Copy'}
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={downloadBackupCodes}
              className="btn btn-outline"
              style={{ width: '100%', marginBottom: '10px' }}
            >
              ⬇ Download Backup Codes (.txt)
            </button>
            <button
              onClick={() => navigate(getTargetDashboard())}
              className="btn"
              style={{ width: '100%' }}
            >
              I've saved my codes — Continue
            </button>
          </div>
        )}

        {/* Step 4 — Already Enabled */}
        {step === 4 && (
          <div>
            <h3>2FA Status: Active ✓</h3>
            <p>Your account is protected with Two-Factor Authentication.</p>
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                padding: '15px',
                borderRadius: '10px',
                marginBottom: '15px',
                color: '#22c55e',
                fontWeight: '600',
              }}
            >
              2FA is currently enabled on your account.
            </div>

            {/* Disable 2FA modal (inline) */}
            {showDisableModal ? (
              <div
                style={{
                  background: 'var(--surface-200)',
                  border: '1px solid rgba(220, 53, 69, 0.35)',
                  borderRadius: '12px',
                  padding: '20px',
                  marginBottom: '15px',
                }}
              >
                <h4 style={{ color: '#dc3545', marginTop: 0 }}>⚠ Disable Two-Factor Authentication</h4>
                <p style={{ color: 'var(--ink-600)', fontSize: '0.9rem', marginBottom: '16px' }}>
                  Disabling 2FA will make your account less secure. Confirm with your password and current authenticator code.
                </p>
                <form onSubmit={handleDisable2FA}>
                  <div className="form-group">
                    <label>Current Password</label>
                    <div style={{ position: 'relative' }}>
                      <input
                        type={showDisablePassword ? 'text' : 'password'}
                        value={disablePassword}
                        onChange={(e) => setDisablePassword(e.target.value)}
                        placeholder="Enter your password"
                        required
                        style={{ paddingRight: '2.5rem' }}
                      />
                      <button
                        type="button"
                        aria-label={showDisablePassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowDisablePassword((p) => !p)}
                        style={{
                          position: 'absolute', right: '0.5rem', top: '50%',
                          transform: 'translateY(-50%)', background: 'none',
                          border: 'none', padding: 0, cursor: 'pointer',
                        }}
                      >
                        <EyeIcon open={showDisablePassword} />
                      </button>
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Authenticator Code (6 digits)</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={disableTOTP}
                      onChange={(e) => setDisableTOTP(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      maxLength="6"
                      style={{ textAlign: 'center', fontSize: '20px', letterSpacing: '4px' }}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
                    <button
                      type="submit"
                      className="btn"
                      disabled={disableLoading || disablePassword.length < 6 || disableTOTP.length !== 6}
                      style={{ flex: 1, backgroundColor: '#dc3545', borderColor: '#dc3545' }}
                    >
                      {disableLoading ? 'Disabling...' : 'Confirm Disable'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      style={{ flex: 1 }}
                      onClick={() => {
                        setShowDisableModal(false);
                        setDisablePassword('');
                        setDisableTOTP('');
                        setError('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <button
                onClick={() => { setShowDisableModal(true); setError(''); setSuccess(''); }}
                disabled={loading}
                className="btn"
                style={{ width: '100%', backgroundColor: '#dc3545', borderColor: '#dc3545', marginBottom: '10px' }}
              >
                Disable 2FA
              </button>
            )}

            <button
              onClick={() => navigate(getTargetDashboard())}
              className="btn btn-outline"
              style={{ width: '100%' }}
            >
              Back to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TwoFactorSetup;
