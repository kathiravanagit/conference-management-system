import React, { useState, useEffect } from 'react';
import { FaChartBar, FaTrophy, FaUsers, FaChartLine } from 'react-icons/fa';
import api from '../../utils/api';
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
        api.get('/analytics'),
        api.get('/analytics/attendance'),
        api.get('/analytics/popular'),
        api.get('/analytics/user-participation'),
      ]);

      setAnalytics(overviewRes.data.analytics);
      setAttendance(attendanceRes.data.data || []);
      setPopular(popularRes.data.data || []);
      setParticipation(participationRes.data.data || []);
      setError('');
    } catch (err) {
      setError('Failed to load analytics data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="analytics-loading">Loading analytics...</div>;
  }

  if (error) {
    return <div className="analytics-error">{error}</div>;
  }

  return (
    <div className="analytics-container">
      <h1 className="analytics-title">
        <FaChartBar className="analytics-icon" />
        Conference Analytics & Reports
      </h1>

      {/* Overview Stats */}
      <div className="analytics-overview">
        <div className="stat-card">
          <div className="stat-icon conferences">
            <FaChartLine />
          </div>
          <div className="stat-content">
            <p className="stat-label">Total Conferences</p>
            <p className="stat-value">{analytics?.totalConferences || 0}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon registrations">
            <FaUsers />
          </div>
          <div className="stat-content">
            <p className="stat-label">Total Registrations</p>
            <p className="stat-value">{analytics?.totalRegistrations || 0}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon attendees">
            <FaTrophy />
          </div>
          <div className="stat-content">
            <p className="stat-label">Active Attendees</p>
            <p className="stat-value">{analytics?.totalAttendees || 0}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon recent">
            <FaChartLine />
          </div>
          <div className="stat-content">
            <p className="stat-label">Recent Registrations</p>
            <p className="stat-value">{analytics?.recentRegistrations || 0}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="analytics-tabs">
        <button
          className={`tab-button ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab-button ${activeTab === 'attendance' ? 'active' : ''}`}
          onClick={() => setActiveTab('attendance')}
        >
          Attendance Stats
        </button>
        <button
          className={`tab-button ${activeTab === 'popular' ? 'active' : ''}`}
          onClick={() => setActiveTab('popular')}
        >
          Popular Conferences
        </button>
        <button
          className={`tab-button ${activeTab === 'participation' ? 'active' : ''}`}
          onClick={() => setActiveTab('participation')}
        >
          Top Participants
        </button>
      </div>

      {/* Tab Content */}
      <div className="analytics-content">
        {/* Attendance Statistics Table */}
        {activeTab === 'attendance' && (
          <div className="table-section">
            <h2>Conference Attendance Statistics</h2>
            {attendance.length > 0 ? (
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
                      <td>{new Date(item.startDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="no-data">No attendance data available</p>
            )}
          </div>
        )}

        {/* Popular Conferences */}
        {activeTab === 'popular' && (
          <div className="table-section">
            <h2>Most Popular Conferences</h2>
            {popular.length > 0 ? (
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
                      <td>{new Date(item.startDate).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="no-data">No conference data available</p>
            )}
          </div>
        )}

        {/* Top Participants */}
        {activeTab === 'participation' && (
          <div className="table-section">
            <h2>Most Active Participants</h2>
            {participation.length > 0 ? (
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
            ) : (
              <p className="no-data">No participation data available</p>
            )}
          </div>
        )}

        {/* Overview */}
        {activeTab === 'overview' && (
          <div className="overview-section">
            <div className="overview-card">
              <h3>Summary</h3>
              <ul className="overview-list">
                <li>
                  <span className="label">Total Conferences Hosted:</span>
                  <span className="value">{analytics?.totalConferences}</span>
                </li>
                <li>
                  <span className="label">Conferences in Last {analytics?.timeframe}:</span>
                  <span className="value">{analytics?.recentConferences}</span>
                </li>
                <li>
                  <span className="label">Total Registrations:</span>
                  <span className="value">{analytics?.totalRegistrations}</span>
                </li>
                <li>
                  <span className="label">Recent Registrations:</span>
                  <span className="value">{analytics?.recentRegistrations}</span>
                </li>
                <li>
                  <span className="label">Active Participants:</span>
                  <span className="value">{analytics?.totalAttendees}</span>
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
