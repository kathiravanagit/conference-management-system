import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import './Auth.css';

const ConfirmLogin = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const { confirmLogin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const handleConfirm = async () => {
      const token = searchParams.get('token');

      if (!token) {
        setStatus('error');
        setMessage('Invalid or missing token');
        return;
      }

      try {
        const result = await confirmLogin(token);
        if (result?.requires2FA) {
          setStatus('success');
          setMessage('Email confirmed. Complete 2FA to finish login.');
          setTimeout(() => {
            navigate('/login', {
              state: {
                message: 'Email confirmed. Please enter your 2FA code.',
                twoFactorToken: result.twoFactorToken,
              },
            });
          }, 1200);
          return;
        }

        setStatus('success');
        setMessage('Login confirmed. Redirecting...');
        setTimeout(() => navigate('/conferences'), 1200);
      } catch (error) {
        setStatus('error');
        setMessage(error.response?.data?.message || 'Login confirmation failed');
      }
    };

    handleConfirm();
  }, [confirmLogin, navigate, searchParams]);

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h2>Confirming Login</h2>
        {status === 'loading' && <p className="auth-subtitle">Verifying your request...</p>}
        {status === 'success' && <div className="info-message">{message}</div>}
        {status === 'error' && <div className="info-message">{message}</div>}
      </div>
    </div>
  );
};

export default ConfirmLogin;
