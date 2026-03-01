import React, { useState } from 'react';
import EyeIcon from '../../components/ui/EyeIcon';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';
import ErrorMessage from '../../components/ui/ErrorMessage';
import './Auth.css';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const { login, googleLogin, logout, verifyTwoFactor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setError('');
      setLoading(true);
      try {
        const result = await googleLogin(tokenResponse.access_token);
        if (result?.requires2FA) {
          setRequires2FA(true);
          setTwoFactorToken(result.twoFactorToken);
          setInfo(result.message || 'Two-factor verification required.');
          return;
        }
        navigate('/conferences');
      } catch (err) {
        setError(err.response?.data?.message || 'Google login failed');
      } finally {
        setLoading(false);
      }
    }
  });

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
      const result = await login(email, password, rememberMe);
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
                  <option value="admin">IT Admin</option>
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
                <div style={{ position: 'relative' }}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ paddingRight: '2.5rem' }}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((prev) => !prev)}
                    style={{
                      position: 'absolute',
                      right: '0.5rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                    }}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
                <div className="auth-helper" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', margin: 0, fontWeight: 'normal', fontSize: '0.9rem' }}>
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      style={{ width: 'auto', margin: 0 }}
                    />
                    Remember Me
                  </label>
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
          <>
            <div className="auth-divider">
              <span>or</span>
            </div>

            <button
              type="button"
              className="google-btn"
              onClick={() => handleGoogleLogin()}
            >
              <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google Logo" />
              Continue with Google
            </button>
          </>
        )}

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
