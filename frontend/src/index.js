import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  // NOTE: StrictMode is intentionally omitted to prevent double-mounting issues
  // with third-party scripts (e.g. Google Identity Services).
  <App />
);
