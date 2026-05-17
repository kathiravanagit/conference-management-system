import React, { useState, useEffect, useRef, useCallback } from 'react';
import EyeIcon from '../../components/ui/EyeIcon';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ErrorMessage from '../../components/ui/ErrorMessage';
import './Auth.css';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [gsiReady, setGsiReady] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorToken, setTwoFactorToken] = useState('');

  const { login, googleLogin, logout, verifyTwoFactor } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectParam = new URLSearchParams(location.search).get('redirect');
  const redirectPath = redirectParam && redirectParam.startsWith('/') ? redirectParam : '/conferences';

  // We use a ref so the callback always has fresh state without re-initializing the client
  const tokenClientRef = useRef(null);
  const onGoogleSuccess = useRef(null);
  const googleTimeoutRef = useRef(null); // Safety timeout in case popup callback never fires

  // Keep the success handler up-to-date without needing to reinitialize the token client
  onGoogleSuccess.current = useCallback(async (accessToken) => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await googleLogin(accessToken);
      if (result?.requires2FA) {
        setRequires2FA(true);
        setTwoFactorToken(result.twoFactorToken);
        setInfo(result.message || 'Two-factor verification required.');
        return;
      }
      navigate(redirectPath);
    } catch (err) {
      console.error('[Google Login] Error:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Google login failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }, [googleLogin, navigate, redirectPath]);

  // Load the Google Identity Services script directly — no library wrapper needed
  useEffect(() => {
    // If already loaded (e.g. hot reload), initialize immediately
    if (window.google?.accounts?.oauth2) {
      initTokenClient();
      return;
    }

    // Check if script tag already exists
    if (document.getElementById('gsi-script')) {
      return;
    }

    const script = document.createElement('script');
    script.id = 'gsi-script';
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => {
      console.log('[Google] GSI script loaded');
      initTokenClient();
    };
    script.onerror = () => {
      console.error('[Google] Failed to load GSI script');
      setError('Could not load Google sign-in. Check your internet connection.');
    };
    document.body.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function initTokenClient() {
    if (!GOOGLE_CLIENT_ID) {
      console.error('[Google] REACT_APP_GOOGLE_CLIENT_ID is not set');
      return;
    }
    tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: 'openid email profile',
      // OAuth callback — called when user completes or denies sign-in
      callback: (tokenResponse) => {
        clearTimeout(googleTimeoutRef.current);
        if (tokenResponse.error) {
          console.error('[Google] Token error:', tokenResponse.error, tokenResponse.error_subtype);
          setGoogleLoading(false);
          if (tokenResponse.error !== 'access_denied') {
            setError('Google sign-in failed. Please try again.');
          }
          // access_denied = user cancelled, no error message needed
          return;
        }
        if (onGoogleSuccess.current) {
          onGoogleSuccess.current(tokenResponse.access_token);
        }
      },
      // error_callback — called for NON-OAuth errors: popup blocked, popup closed, etc.
      error_callback: (err) => {
        clearTimeout(googleTimeoutRef.current);
        console.error('[Google] Non-OAuth error:', err?.type, err);
        setGoogleLoading(false);
        if (err?.type === 'popup_failed_to_open') {
          setError(
            'Google sign-in popup was blocked by your browser. ' +
            'Please click the address bar icon to allow popups for this site, then try again.'
          );
        } else if (err?.type === 'popup_closed') {
          // User closed the popup manually — no error message needed
        } else {
          setError('Google sign-in failed. Please try again.');
        }
      },
    });
    setGsiReady(true);
    console.log('[Google] Token client initialized');
  }

  const handleGoogleClick = () => {
    if (!tokenClientRef.current) {
      setError('Google sign-in is not ready yet. Please wait a moment and try again.');
      return;
    }
    setError('');
    setGoogleLoading(true);

    // Safety net: if popup callback never fires (completely silent block),
    // reset after 2 minutes so the button doesn't stay stuck forever.
    googleTimeoutRef.current = setTimeout(() => {
      setGoogleLoading(false);
      setError(
        'Google sign-in timed out. If a popup was blocked, please allow popups for this site and try again.'
      );
    }, 120000);

    tokenClientRef.current.requestAccessToken({ prompt: 'select_account' });
  };

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
      navigate(redirectPath);
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
      navigate(redirectPath);
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
              id="google-login-btn"
              className="google-btn"
              disabled={googleLoading || !gsiReady}
              onClick={handleGoogleClick}
            >
              <img
                src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg"
                alt="Google Logo"
              />
              {googleLoading ? 'Signing in...' : !gsiReady ? 'Loading...' : 'Continue with Google'}
            </button>
          </>
        )}

        {!requires2FA && (
          <p className="auth-link">
            Don't have an account? <Link to={`/register${location.search || ''}`}>Register here</Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default Login;
