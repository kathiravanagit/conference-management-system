import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { conferenceAPI } from '../../utils/api';
import { formatDate, formatTime } from '../../utils/helpers';
import {
  FaMousePointer,
  FaVideo,
  FaCertificate,
  FaComments,
  FaTrophy,
  FaStar,
  FaUserGraduate,
  FaChalkboardTeacher,
  FaServer,
} from 'react-icons/fa';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [heroConference, setHeroConference] = useState(null);

  useEffect(() => {
    const loadHeroConference = async () => {
      try {
        const ongoingResponse = await conferenceAPI.getAll({ status: 'ongoing' });
        const ongoingConference = ongoingResponse.data.conferences?.[0];

        if (ongoingConference) {
          setHeroConference(ongoingConference);
          return;
        }

        const upcomingResponse = await conferenceAPI.getAll({ status: 'upcoming' });
        setHeroConference(upcomingResponse.data.conferences?.[0] || null);
      } catch (error) {
        setHeroConference(null);
      }
    };

    loadHeroConference();
  }, []);

  const features = [
    {
      icon: <FaMousePointer />,
      title: 'Easy Registration',
      desc: 'Register for conferences with just one click. Track your registrations instantly.',
      color: '#16a34a',
    },
    {
      icon: <FaVideo />,
      title: 'Live Meetings',
      desc: 'Join virtual conferences with integrated Zoom, Meet, or custom links.',
      color: '#2563eb',
    },
    {
      icon: <FaCertificate />,
      title: 'Certificates',
      desc: 'Earn and download professional certificates of attendance and participation.',
      color: '#9333ea',
    },
    {
      icon: <FaComments />,
      title: 'Live Q&A',
      desc: 'Participate in real-time discussions and moderated Q&A sessions.',
      color: '#ea580c',
    },
    {
      icon: <FaTrophy />,
      title: 'Leaderboard',
      desc: 'Compete and earn points for conferences attended, feedback given, and more.',
      color: '#ca8a04',
    },
    {
      icon: <FaStar />,
      title: 'Feedback & Ratings',
      desc: 'Rate conferences and provide feedback to improve future events.',
      color: '#0891b2',
    },
  ];

  const roles = [
    {
      icon: <FaUserGraduate />,
      title: 'Students',
      desc: 'Discover events, register instantly, earn certificates, and climb the leaderboard.',
    },
    {
      icon: <FaChalkboardTeacher />,
      title: 'Staff',
      desc: 'Create conferences, manage sessions, moderate Q&A, and upload certificates.',
    },
    {
      icon: <FaServer />,
      title: 'Admin / IT',
      desc: 'Maintain integrations, audit attendance data, and ensure platform uptime.',
    },
  ];

  return (
    <div className="home">
      {/* Floating background shapes */}
      <div className="hero-bg-shapes">
        <div className="shape shape-1" />
        <div className="shape shape-2" />
        <div className="shape shape-3" />
      </div>

      <section className="hero">
        <div className="hero-grid">
          <div className="hero-text">
            <p className="hero-eyebrow">Academic events, simplified</p>
            <h1>
              Run conferences, manage attendance, and grow engagement
              across your campus.
            </h1>
            <p className="hero-subtitle">
              ConferenceHub brings students, staff, and IT together with
              one-click registration, live meetings, instant certificates, and
              real-time Q&A.
            </p>
            <div className="hero-actions">
              <button
                onClick={() => navigate('/conferences')}
                className="btn btn-primary"
              >
                Explore Conferences
              </button>
              {!isAuthenticated && (
                <button
                  onClick={() => navigate('/register')}
                  className="btn btn-outline"
                >
                  Create Your Account
                </button>
              )}
            </div>
            <div className="hero-meta">
              <span>Built for students, staff, and IT departments</span>
              <span>Secure access with role-based accounts</span>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-card card">
              <div className="hero-card-header">
                <div>
                  <p className="hero-card-title">Live Conference Room</p>
                  <p className="hero-card-subtitle">
                    {heroConference?.title || 'Conference schedule updates here'}
                  </p>
                </div>
                <span className="hero-pill">{heroConference?.status || 'Upcoming'}</span>
              </div>
              <div className="hero-card-body">
                <div className="hero-stat">
                  <p>Attendees</p>
                  <strong>{heroConference?.attendeeCount ?? '--'}</strong>
                </div>
                <div className="hero-stat">
                  <p>Department</p>
                  <strong>{heroConference?.department || '--'}</strong>
                </div>
                <div className="hero-stat">
                  <p>Date</p>
                  <strong>{heroConference ? formatDate(heroConference.date) : '--'}</strong>
                </div>
              </div>
              {heroConference && (
                <div className="hero-card-time">
                  {formatTime(heroConference.date)}
                  {heroConference.endDate && <> – {formatTime(heroConference.endDate)}</>}
                </div>
              )}
              {heroConference?.meetingLink && isAuthenticated ? (
                <a
                  className="btn btn-soft hero-card-button"
                  href={heroConference.meetingLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Join meeting dashboard
                </a>
              ) : (
                <button className="btn btn-soft hero-card-button" onClick={() => {
                  if (isAuthenticated) {
                    navigate('/meetings');
                  } else {
                    navigate('/login');
                  }
                }}>
                  {isAuthenticated ? 'View meeting dashboard' : 'Login to join meeting'}
                </button>
              )}
            </div>
            <div className="hero-strip">
              <div>
                <p className="strip-label">Instant registration</p>
                <strong>One click per event</strong>
              </div>
              <div>
                <p className="strip-label">Automated certificates</p>
                <strong>Download-ready in minutes</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="features">
        <div className="section-heading">
          <p className="section-eyebrow">Everything in one platform</p>
          <h2>Workflows that keep conferences running smoothly</h2>
          <p className="section-subtitle">
            Launch events, host live sessions, and reward participation with
            tools that connect directly to your database.
          </p>
        </div>
        <div className="features-grid">
          {features.map((f, i) => (
            <div className="feature-card" key={i} style={{ animationDelay: `${i * 0.08}s` }}>
              <div className="feature-icon" style={{ background: `${f.color}15`, color: f.color }}>
                {f.icon}
              </div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="roles">
        <div className="roles-content">
          <h2>Designed for every campus role</h2>
          <p>
            Give each group the experience they need with the same reliable
            data foundation.
          </p>
          <div className="roles-grid">
            {roles.map((r, i) => (
              <div className="role-card" key={i}>
                <div className="role-icon">{r.icon}</div>
                <h3>{r.title}</h3>
                <p>{r.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="cta-card">
          <div>
            <h2>Ready to launch your next conference?</h2>
            <p>
              Start exploring conferences today and deliver a professional
              experience to every attendee.
            </p>
          </div>
          <button onClick={() => navigate('/conferences')} className="btn btn-primary">
            Browse Conferences
          </button>
        </div>
      </section>
    </div>
  );
};

export default Home;
