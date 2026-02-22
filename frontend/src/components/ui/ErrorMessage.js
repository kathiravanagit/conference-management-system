import React from 'react';
import { FaExclamationTriangle } from 'react-icons/fa';
import './ErrorMessage.css';

const ErrorMessage = ({ message, onClose }) => {
  if (!message) return null;

  return (
    <div className="error-message">
      <FaExclamationTriangle />
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="close-btn">
          ✕
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;
