import React from 'react';

const EyeIcon = ({ open = false, ...props }) => (
  open ? (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" {...props}>
      <path d="M1 10C1 10 4.5 4 10 4C15.5 4 19 10 19 10C19 10 15.5 16 10 16C4.5 16 1 10 1 10Z" stroke="#888" strokeWidth="2"/>
      <circle cx="10" cy="10" r="3" stroke="#888" strokeWidth="2"/>
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" {...props}>
      <path d="M1 10C1 10 4.5 4 10 4C15.5 4 19 10 19 10C19 10 15.5 16 10 16C4.5 16 1 10 1 10Z" stroke="#888" strokeWidth="2"/>
      <circle cx="10" cy="10" r="3" stroke="#888" strokeWidth="2"/>
      <line x1="4" y1="16" x2="16" y2="4" stroke="#888" strokeWidth="2"/>
    </svg>
  )
);

export default EyeIcon;
