import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import ErrorMessage from '../../components/ui/ErrorMessage';
import './Auth.css';

const TwoFactorSetup = () => {
  const [step, setStep] = useState(1); // 1: Not setup, 2: Setup QR, 3: Verify, 4: Backup codes
  const [qrCode, setQrCode] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    checkTwoFactorStatus();
  }, []);

  const checkTwoFactorStatus = async () => {
    try {
      const response = await axios.get('/api/auth/me');
      setTwoFactorEnabled(response.data.user?.twoFactorEnabled || false);
      if (response.data.user?.twoFactorEnabled) {
        setStep(4); // Show backup codes if already enabled
      }
    } catch (err) {
      console.error('Error checking 2FA status:', err);
    }
  };

  const handleSetup2FA = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await axios.post('/api/auth/2fa/setup');
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
      const response = await axios.post('/api/auth/2fa/verify-setup', {
        token: verificationCode,
      });
      const nextBackupCodes = response.data?.data?.backupCodes || [];
      setBackupCodes(nextBackupCodes);
      setTwoFactorEnabled(true);
      setStep(3);
      setSuccess('2FA Setup complete! Save your backup codes in a safe place.');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (
      window.confirm(
        '⚠️ Warning: Disabling 2FA will make your account less secure. Are you sure?'
      )
    ) {
      try {
        setLoading(true);
        setError('');
        await axios.post('/api/auth/2fa/disable');
        setTwoFactorEnabled(false);
        setStep(1);
        setSuccess('2FA disabled successfully.');
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to disable 2FA');
      } finally {
        setLoading(false);
      }
    }
  };

  const copyBackupCode = (code) => {
    navigator.clipboard.writeText(code);
    alert('Backup code copied to clipboard!');
  };

  if (!user) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Two-Factor Authentication</h2>

        {error && <ErrorMessage message={error} />}
        {success && (
          <div className="success-message" style={{ background: 'rgba(34, 197, 94, 0.12)', color: '#22c55e', padding: '10px', borderRadius: '10px', marginBottom: '20px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
            {success}
          </div>
        )}

        {!twoFactorEnabled && step === 1 && (
          <div>
            <p style={{ marginBottom: '20px' }}>
              Two-Factor Authentication adds an extra layer of security to your account. You'll need to enter a code from an authenticator app in addition to your password when logging in.
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
                  width: '250px',
                  height: '250px',
                  border: '2px solid var(--brand-500)',
                  padding: '10px',
                  background: '#fff',
                  borderRadius: '10px'
                }}
              />
            </div>
            <div className="form-group">
              <label>Enter 6-digit verification code:</label>
              <input
                type="text"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.slice(0, 6))}
                placeholder="000000"
                maxLength="6"
                disabled={loading}
                style={{ textAlign: 'center', fontSize: '24px', letterSpacing: '5px' }}
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

        {step === 3 && (
          <div>
            <h3>Step 2: Save Backup Codes</h3>
            <p>
              Save these backup codes in a safe place. You can use them to access your account if you lose your authenticator device.
            </p>
            <div
              style={{
                background: 'var(--surface-200)',
                padding: '15px',
                borderRadius: '10px',
                marginBottom: '15px',
                maxHeight: '200px',
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
                    padding: '8px',
                    borderBottom: index < backupCodes.length - 1 ? '1px solid var(--divider)' : 'none',
                    fontFamily: 'monospace',
                    color: 'var(--ink-900)'
                  }}
                >
                  <span>{code}</span>
                  <button
                    onClick={() => copyBackupCode(code)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--brand-700)',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() => navigate('/conferences')}
              className="btn"
              style={{ width: '100%' }}
            >
              I've saved my codes - Continue
            </button>
          </div>
        )}

        {step === 4 && (
          <div>
            <h3>2FA Status: Active</h3>
            <p>Your account is protected with Two-Factor Authentication.</p>
            <div
              style={{
                background: 'rgba(34, 197, 94, 0.12)',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                padding: '15px',
                borderRadius: '10px',
                marginBottom: '15px',
                color: '#22c55e',
                fontWeight: '600'
              }}
            >
              2FA is currently enabled on your account.
            </div>
            <button
              onClick={handleDisable2FA}
              disabled={loading}
              className="btn"
              style={{
                width: '100%',
                backgroundColor: '#dc3545',
              }}
            >
              {loading ? 'Disabling...' : 'Disable 2FA'}
            </button>
            <button
              onClick={() => navigate('/conferences')}
              className="btn"
              style={{ width: '100%', marginTop: '10px' }}
            >
              Back to Conferences
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default TwoFactorSetup;
