import React from 'react';
import { useNavigate } from 'react-router-dom';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '70vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '2rem',
      gap: '1.5rem',
    }}>
      <div style={{
        fontSize: '6rem',
        fontWeight: '900',
        background: 'linear-gradient(135deg, var(--brand-500, #16a34a), var(--brand-700, #15803d))',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        lineHeight: 1,
      }}>
        404
      </div>
      <h1 style={{ fontSize: '1.8rem', fontWeight: 700, margin: 0 }}>
        Page Not Found
      </h1>
      <p style={{ color: 'var(--ink-500, #6b7280)', maxWidth: '400px', margin: 0, lineHeight: 1.6 }}>
        The page you're looking for doesn't exist or has been moved. Check the URL or head back to safety.
      </p>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          id="notfound-home-btn"
          className="btn btn-primary"
          onClick={() => navigate('/')}
        >
          Go Home
        </button>
        <button
          id="notfound-back-btn"
          className="btn btn-outline"
          onClick={() => navigate(-1)}
        >
          Go Back
        </button>
      </div>
    </div>
  );
};

export default NotFound;
