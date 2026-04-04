import React, { useState } from 'react';
import EyeIcon from '../../components/ui/EyeIcon';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGoogleLogin } from '@react-oauth/google';
import ErrorMessage from '../../components/ui/ErrorMessage';
import './Auth.css';

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
  const { register, googleLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectParam = new URLSearchParams(location.search).get('redirect');
  const redirectPath = redirectParam && redirectParam.startsWith('/') ? redirectParam : '/conferences';

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setError('');
      setLoading(true);
      try {
        const result = await googleLogin(tokenResponse.access_token);
        if (result?.requires2FA) {
          // Since it's register we probably don't have 2FA yet, but just in case
          navigate('/login', {
            state: {
              twoFactorToken: result.twoFactorToken,
              message: 'Two-factor verification required.'
            }
          });
          return;
        }
        navigate(redirectPath);
      } catch (err) {
        setError(err.response?.data?.message || 'Google signup failed');
      } finally {
        setLoading(false);
      }
    }
  });

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
                <option value="AIML">AI & Machine Learning (AIML)</option>
                <option value="EEE">Electrical & Electronics (EEE)</option>
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
          onClick={() => handleGoogleLogin()}
        >
          <img src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg" alt="Google Logo" />
          Continue with Google
        </button>

        <p className="auth-link">
          Already have an account? <Link to={`/login${location.search || ''}`}>Login here</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
