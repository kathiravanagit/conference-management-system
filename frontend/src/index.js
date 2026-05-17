import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

import { GoogleOAuthProvider } from '@react-oauth/google';

const root = ReactDOM.createRoot(document.getElementById('root'));
const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || '1234567890-mockclientid.apps.googleusercontent.com';

root.render(
  // NOTE: React.StrictMode is intentionally removed — it breaks @react-oauth/google
  // in React 18 dev mode by double-invoking hooks, causing the Google popup to fail.
  <GoogleOAuthProvider clientId={clientId}>
    <App />
  </GoogleOAuthProvider>
);
