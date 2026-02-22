import React, { useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ErrorMessage from '../../components/ui/ErrorMessage';
import './Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const { login, logout, verifyTwoFactor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  React.useEffect(() => {
    if (location.state?.message) {
      setInfo(location.state.message);
      window.history.replaceState({}, document.title);
    }
    if (location.state?.twoFactorToken) {
      setRequires2FA(true);
      setTwoFactorToken(location.state.twoFactorToken);
    }
  }, [location.state]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(email, password);
      if (result?.confirmationRequired) {
        setInfo(result.message || 'Please check your email to confirm login.');
        return;
      }

      if (result?.requires2FA) {
        setRequires2FA(true);
        setTwoFactorToken(result.twoFactorToken);
        setInfo(result.message || 'Two-factor verification required.');
        return;
      }

      const loggedInUser = result?.user || result;
      if (loggedInUser?.role && loggedInUser.role !== role) {
        logout();
        setError('Selected role does not match this account.');
        return;
      }
      navigate('/conferences');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setError('');
    setInfo('');

    if (!twoFactorCode) {
      setError('Please enter your 2FA code.');
      return;
    }

    setLoading(true);

    try {
      const verifiedUser = await verifyTwoFactor(twoFactorToken, twoFactorCode);
      if (verifiedUser?.role && verifiedUser.role !== role) {
        logout();
        setError('Selected role does not match this account.');
        return;
      }
      navigate('/conferences');
    } catch (err) {
      setError(err.response?.data?.message || '2FA verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Login</h2>
        <p className="auth-subtitle">Access your conferences and activity.</p>
        {info && <div className="info-message">{info}</div>}
        {error && <ErrorMessage message={error} onClose={() => setError('')} />}

        <form onSubmit={requires2FA ? handleVerify2FA : handleSubmit}>
          {requires2FA ? (
            <div className="form-group">
              <label htmlFor="twoFactorCode">2FA Code</label>
              <input
                id="twoFactorCode"
                type="text"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                required
              />
              <div className="auth-helper">
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setRequires2FA(false);
                    setTwoFactorCode('');
                    setTwoFactorToken('');
                  }}
                >
                  Back to login
                </button>
              </div>
            </div>
          ) : (
            <>
          <div className="form-group">
            <label htmlFor="role">Account Type</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
            >
              <option value="student">Student</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <div className="auth-helper">
              <Link to="/forgot-password">Forgot password?</Link>
            </div>
          </div>
            </>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Please wait...' : requires2FA ? 'Verify' : 'Login'}
          </button>
        </form>

        {!requires2FA && (
          <p className="auth-link">
            Don't have an account? <Link to="/register">Register here</Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default Login;
