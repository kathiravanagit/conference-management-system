import React, { useState, useEffect, useCallback } from 'react';
import EyeIcon from '../../components/ui/EyeIcon';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import ErrorMessage from '../../components/ui/ErrorMessage';
import './Auth.css';

const GOOGLE_CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID;
const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'student',
    department: 'CSE',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectParam = new URLSearchParams(location.search).get('redirect');

  const getPasswordStrength = (pwd) => {
    if (!pwd) return null;
    let score = 0;
    if (pwd.length >= 8) score++;
    if (/[A-Z]/.test(pwd)) score++;
    if (/[0-9]/.test(pwd)) score++;
    if (/[^A-Za-z0-9]/.test(pwd)) score++;
    if (score <= 1) return { label: 'Weak', color: '#ef4444', width: '33%' };
    if (score <= 2) return { label: 'Fair', color: '#f59e0b', width: '66%' };
    return { label: 'Strong', color: '#22c55e', width: '100%' };
  };

  const passwordStrength = getPasswordStrength(formData.password);

  // ─── Google Redirect Flow ───────────────────────────────────────────────────
  const handleGoogleToken = useCallback(async (accessToken) => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await googleLogin(accessToken);
      if (result?.requires2FA) {
        navigate('/login', {
          state: {
            twoFactorToken: result.twoFactorToken,
            message: 'Two-factor verification required.',
          },
        });
        return;
      }
      const loggedInUser = result?.user || result;
      const targetPath = redirectParam && redirectParam.startsWith('/')
        ? redirectParam
        : (['staff', 'it', 'admin'].includes(loggedInUser?.role) ? '/staff/dashboard' : '/dashboard');
      navigate(targetPath);
    } catch (err) {
      console.error('[Google Register] Error:', err.response?.data || err.message);
      setError(err.response?.data?.message || 'Google signup failed. Please try again.');
    } finally {
      setGoogleLoading(false);
    }
  }, [googleLogin, navigate, redirectParam]);

  // On page load: check if Google redirected back with a token in the URL hash
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash) return;
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const state = params.get('state');
    if (accessToken && state === 'google_oauth_register') {
      window.history.replaceState({}, document.title, window.location.pathname);
      handleGoogleToken(accessToken);
    }
  }, [handleGoogleToken]);

  // Redirect to Google — no popup, works everywhere
  const handleGoogleClick = () => {
    if (!GOOGLE_CLIENT_ID) {
      setError('Google login is not configured.');
      return;
    }
    const redirectUri = window.location.origin + '/register';
    const params = new URLSearchParams({
      client_id: GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      response_type: 'token',
      scope: 'openid email profile',
      include_granted_scopes: 'true',
      state: 'google_oauth_register',
      prompt: 'select_account',
    });
    window.location.href = `${GOOGLE_OAUTH_URL}?${params.toString()}`;
  };
  // ────────────────────────────────────────────────────────────────────────────

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const departmentToSubmit = formData.role === 'admin' ? 'IT' : formData.department;

      const response = await register(
        formData.name,
        formData.email,
        formData.password,
        departmentToSubmit,
        formData.role
      );
      setInfo(response?.message || 'Registration successful. Please check your email.');
      setTimeout(() => {
        navigate(`/login${location.search || ''}`, {
          state: {
            message: response?.message || 'Registration successful. Please check your email to confirm your account.',
          },
        });
      }, 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Register</h2>
        <p className="auth-subtitle">Create your role-based account.</p>
        {info && <div className="info-message">{info}</div>}
        {error && <ErrorMessage message={error} onClose={() => setError('')} />}

        {googleLoading && (
          <div className="info-message" style={{ textAlign: 'center' }}>
            Completing Google sign-in, please wait...
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="role">Account Type</label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
            >
              <option value="student">Student</option>
              <option value="staff">Staff</option>
              <option value="admin">IT Admin</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
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
            {passwordStrength && (
              <div style={{ marginTop: '6px' }}>
                <div style={{ height: '4px', borderRadius: '4px', background: 'var(--surface-300, #e5e7eb)', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: passwordStrength.width, background: passwordStrength.color, transition: 'width 0.3s, background 0.3s', borderRadius: '4px' }} />
                </div>
                <span style={{ fontSize: '0.78rem', color: passwordStrength.color, fontWeight: 600 }}>{passwordStrength.label}</span>
              </div>
            )}
          </div>

          {formData.role !== 'admin' && (
            <div className="form-group">
              <label htmlFor="department">Department</label>
              <select
                id="department"
                name="department"
                value={formData.department}
                onChange={handleChange}
              >
                <option value="CSE">Computer Science (CSE)</option>
                <option value="ECE">Electronics (ECE)</option>
                <option value="MECH">Mechanical (MECH)</option>
                <option value="AIML">AI &amp; Machine Learning (AIML)</option>
                <option value="EEE">Electrical &amp; Electronics (EEE)</option>
                <option value="FT">Food Technology (FT)</option>
                <option value="IT">Information Technology (IT)</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          )}

          <button type="submit" disabled={loading}>
            {loading ? 'Registering...' : 'Register'}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button
          type="button"
          className="google-btn"
          disabled={googleLoading}
          onClick={handleGoogleClick}
        >
          <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google Logo" />
          {googleLoading ? 'Signing in...' : 'Continue with Google'}
        </button>

        <p className="auth-link">
          Already have an account? <Link to={`/login${location.search || ''}`}>Login here</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
