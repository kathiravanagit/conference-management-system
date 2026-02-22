import React from 'react';
import { FaCalendarAlt, FaUser, FaMapMarkerAlt, FaClock } from 'react-icons/fa';
import { formatDate, formatTime, truncateText } from '../../utils/helpers';
import './ConferenceCard.css';

const ConferenceCard = ({ conference, onRegister, isRegistered, isCreator }) => {
  // Generate initials for fallback poster
  const initials = conference.title
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  // Deterministic color from title
  const hashCode = conference.title.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
  const gradients = [
    'linear-gradient(135deg, #0b6e4f, #1bb18a)',
    'linear-gradient(135deg, #2563eb, #60a5fa)',
    'linear-gradient(135deg, #9333ea, #c084fc)',
    'linear-gradient(135deg, #ea580c, #fb923c)',
    'linear-gradient(135deg, #0891b2, #22d3ee)',
    'linear-gradient(135deg, #dc2626, #f87171)',
  ];
  const fallbackGradient = gradients[hashCode % gradients.length];

  return (
    <div className="conference-card">
      {conference.poster ? (
        <div className="conference-poster">
          <img src={conference.poster} alt={conference.title} />
        </div>
      ) : (
        <div className="conference-poster-fallback" style={{ background: fallbackGradient }}>
          <span className="poster-initials">{initials}</span>
        </div>
      )}

      <div className="conference-content">
        <h3 className="conference-title">{conference.title}</h3>

        <p className="conference-description">
          {truncateText(conference.description, 100)}
        </p>

        <div className="conference-meta">
          <div className="meta-item">
            <FaCalendarAlt />
            {formatDate(conference.date)}
          </div>
          <div className="meta-item">
            <FaClock />
            {formatTime(conference.date)}
            {conference.endDate && <> – {formatTime(conference.endDate)}</>}
          </div>
          <div className="meta-item">
            <FaUser />
            {conference.speaker?.name}
          </div>
          {conference.department !== 'ALL' && (
            <div className="meta-item">
              <FaMapMarkerAlt />
              {conference.department}
            </div>
          )}
        </div>

        <div className="conference-stats">
          <span className="attendees">{conference.attendeeCount} attending</span>
          <span className={`status ${conference.status}`}>{conference.status}</span>
        </div>

        <div className="conference-actions">
          {isCreator ? (
            <>
              {conference.status === 'ongoing' && conference.meetingLink && (
                <a
                  href={conference.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-register btn-join-meeting"
                >
                  Join Meeting
                </a>
              )}
            </>
          ) : (
            onRegister && (
              <button
                onClick={() => onRegister(conference._id)}
                disabled={isRegistered || conference.status === 'completed' || conference.status === 'cancelled'}
                className={`btn-register ${isRegistered ? 'disabled' : ''}`}
              >
                {isRegistered ? 'Already Registered' : 'Register'}
              </button>
            )
          )}
          <a href={`/conference/${conference._id}`} className="btn-view-details">
            View Details
          </a>
        </div>
      </div>
    </div>
  );
};

export default ConferenceCard;
