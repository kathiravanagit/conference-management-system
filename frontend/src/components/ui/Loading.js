import React from 'react';
import './Loading.css';

const Loading = ({ message = 'Loading...' }) => {
  return (
    <div className="loading-container">
      <div className="loading-spinner">
        <div className="spinner-ring" />
        <div className="spinner-ring spinner-ring-2" />
        <div className="spinner-dot" />
      </div>
      <p className="loading-text">{message}</p>
    </div>
  );
};

export default Loading;
