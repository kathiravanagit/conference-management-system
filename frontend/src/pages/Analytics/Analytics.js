import React, { useState, useEffect } from 'react';
import {
  FaCalendarAlt,
  FaChartBar,
  FaChartLine,
  FaCheckCircle,
  FaClipboardList,
  FaTrophy,
  FaUsers,
} from 'react-icons/fa';
import Loading from '../../components/ui/Loading';
import ErrorMessage from '../../components/ui/ErrorMessage';
import { handleApiError } from '../../utils/helpers';
import { analyticsAPI } from '../../utils/api';
import './Analytics.css';

function Analytics() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [analytics, setAnalytics] = useState(null);
  const [attendance, setAttendance] = useState([]);
  const [popular, setPopular] = useState([]);
  const [participation, setParticipation] = useState([]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const [overviewRes, attendanceRes, popularRes, participationRes] = await Promise.all([
        analyticsAPI.getOverview(),
        analyticsAPI.getAttendanceStats(),
        analyticsAPI.getPopularConferences(),
        analyticsAPI.getUserParticipation(),
      ]);

      setAnalytics(overviewRes.data.analytics);
      setAttendance(attendanceRes.data.data || []);
      setPopular(popularRes.data.data || []);
      setParticipation(participationRes.data.data || []);
      setError('');
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (date) => (date ? new Date(date).toLocaleDateString() : '-');

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return (
    <div className="analytics-container">
      <div className="analytics-hero">
        <h1 className="analytics-title">
          <FaChartBar className="analytics-title-icon" />
          Conference Analytics
        </h1>
        <p className="analytics-subtitle">
          Track attendance quality, discover popular events, and monitor participant activity.
        </p>
      </div>

      <div className="analytics-overview">
        <div className="analytics-stat-card">
          <div className="analytics-stat-icon conferences">
            <FaClipboardList />
          </div>
          <div>
            <p className="analytics-stat-label">Total Conferences</p>
            <p className="analytics-stat-value">{analytics?.totalConferences || 0}</p>
          </div>
        </div>

        <div className="analytics-stat-card">
          <div className="analytics-stat-icon registrations">
            <FaUsers />
          </div>
          <div>
            <p className="analytics-stat-label">Total Registrations</p>
            <p className="analytics-stat-value">{analytics?.totalRegistrations || 0}</p>
          </div>
        </div>

        <div className="analytics-stat-card">
          <div className="analytics-stat-icon attendees">
            <FaCheckCircle />
          </div>
          <div>
            <p className="analytics-stat-label">Active Attendees</p>
            <p className="analytics-stat-value">{analytics?.totalAttendees || 0}</p>
          </div>
        </div>

        <div className="analytics-stat-card">
          <div className="analytics-stat-icon recent">
            <FaChartLine />
          </div>
          <div>
            <p className="analytics-stat-label">Recent Registrations</p>
            <p className="analytics-stat-value">{analytics?.recentRegistrations || 0}</p>
          </div>
        </div>
      </div>

      <div className="analytics-tabs">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          <FaChartBar />
          Overview
        </button>
        <button
          className={`tab-button ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          <FaCalendarAlt />
          Attendance Stats
        </button>
        <button
          className={`tab-button ${activeTab === 'popular' ? 'active' : ''}`}
          onClick={() => setActiveTab('popular')}
        >
          <FaTrophy />
          Popular Conferences
        </button>
        <button
          className={`tab-button ${activeTab === 'participation' ? 'active' : ''}`}
          onClick={() => setActiveTab('participation')}
        >
          <FaUsers />
          Top Participants
        </button>
      </div>

      <div className="analytics-content">
        {activeTab === 'attendance' && (
          <div className="table-section">
            <h2>Conference Attendance Statistics</h2>
            {attendance.length > 0 ? (
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Conference Title</th>
                    <th>Total Attendees</th>
                    <th>Registrations</th>
                    <th>Attendance Rate</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((item, idx) => (
                    <tr key={idx}>
                      <td className="conference-name">{item.title}</td>
                      <td>{item.totalAttendees}</td>
                      <td>{item.registrations}</td>
                      <td>
                        <span className="attendance-rate">{item.attendanceRate}%</span>
                      </td>
                      <td>{formatDate(item.startDate || item.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            ) : (
              <p className="no-data">No attendance data available</p>
            )}
          </div>
        )}

        {activeTab === 'popular' && (
          <div className="table-section">
            <h2>Most Popular Conferences</h2>
            {popular.length > 0 ? (
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Conference Title</th>
                    <th>Category</th>
                    <th>Total Attendees</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {popular.map((item, idx) => (
                    <tr key={idx}>
                      <td className="conference-name">{item.title}</td>
                      <td>
                        <span className="category-badge">{item.category}</span>
                      </td>
                      <td className="attendee-count">{item.attendees}</td>
                      <td>{formatDate(item.startDate || item.date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            ) : (
              <p className="no-data">No conference data available</p>
            )}
          </div>
        )}

        {activeTab === 'participation' && (
          <div className="table-section">
            <h2>Most Active Participants</h2>
            {participation.length > 0 ? (
              <div className="analytics-table-wrap">
                <table className="analytics-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Participant Name</th>
                    <th>Email</th>
                    <th>Conferences Attended</th>
                  </tr>
                </thead>
                <tbody>
                  {participation.map((item, idx) => (
                    <tr key={idx}>
                      <td className="rank-number">
                        <span className="rank-badge">{idx + 1}</span>
                      </td>
                      <td className="participant-name">{item.name}</td>
                      <td className="participant-email">{item.email}</td>
                      <td className="participation-count">{item.registrationCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            ) : (
              <p className="no-data">No participation data available</p>
            )}
          </div>
        )}

        {activeTab === 'overview' && (
          <div className="overview-section">
            <div className="overview-card">
              <h3>Summary</h3>
              <ul className="overview-list">
                <li>
                  <span className="label">Total Conferences Hosted:</span>
                  <span className="value">{analytics?.totalConferences || 0}</span>
                </li>
                <li>
                  <span className="label">Conferences in Last {analytics?.timeframe}:</span>
                  <span className="value">{analytics?.recentConferences || 0}</span>
                </li>
                <li>
                  <span className="label">Total Registrations:</span>
                  <span className="value">{analytics?.totalRegistrations || 0}</span>
                </li>
                <li>
                  <span className="label">Recent Registrations:</span>
                  <span className="value">{analytics?.recentRegistrations || 0}</span>
                </li>
                <li>
                  <span className="label">Active Participants:</span>
                  <span className="value">{analytics?.totalAttendees || 0}</span>
                </li>
              </ul>
            </div>

            <div className="overview-card info-card">
              <h3>About Analytics</h3>
              <p>
                This analytics dashboard provides insights into conference attendance patterns,
                popular sessions, and participant engagement metrics. Use this data to understand
                conference performance and plan future events.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Analytics;
