import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { conferenceAPI, feedbackAPI, qaAPI } from '../../utils/api';
import { formatDate, formatTime, formatDateTime, handleApiError } from '../../utils/helpers';
import Loading from '../../components/ui/Loading';
import ErrorMessage from '../../components/ui/ErrorMessage';
import RatingForm from '../../components/widgets/RatingForm';
import { useAuth } from '../../context/AuthContext';
import './ConferenceDetail.css';

const ConferenceDetail = () => {
  const { id } = useParams();
  const [conference, setConference] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('info');
  const [qaMessages, setQaMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [feedback, setFeedback] = useState([]);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const { isAuthenticated } = useAuth();

  const fetchConferenceDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await conferenceAPI.getById(id);
      setConference(response.data.conference);

      // Fetch Q&A messages
      const qaResponse = await qaAPI.getMessages(id);
      setQaMessages(qaResponse.data.messages || []);

      // Fetch feedback analytics
      const feedbackResponse = await feedbackAPI.getConferenceFeedback(id);
      setFeedback(feedbackResponse.data.feedback || []);

      setError('');
    } catch (err) {
      setError(handleApiError(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchConferenceDetails();
  }, [fetchConferenceDetails]);

  const handlePostMessage = async () => {
    if (!newMessage.trim()) return;
    if (!isAuthenticated) {
      setError('Please login to post a message.');
      return;
    }

    try {
      await qaAPI.postMessage({
        conferenceId: id,
        message: newMessage,
        isQuestion: false,
      });
      setNewMessage('');
      fetchConferenceDetails();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  const handleSubmitFeedback = async (feedbackData) => {
    if (!isAuthenticated) {
      setError('Please login to submit feedback.');
      return;
    }
    try {
      await feedbackAPI.submitFeedback({
        conferenceId: id,
        ...feedbackData,
      });
      setShowFeedbackForm(false);
      alert('Feedback submitted successfully!');
      fetchConferenceDetails();
    } catch (err) {
      setError(handleApiError(err));
    }
  };

  if (loading) return <Loading />;

  if (!conference) return <ErrorMessage message={error || 'Conference not found'} />;

  const averageRating =
    feedback.length > 0
      ? (feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length).toFixed(1)
      : 0;

  return (
    <div className="conference-detail">
      <div className="detail-container">
        <div className="detail-header">
          {conference.poster && (
            <img src={conference.poster} alt={conference.title} className="detail-poster" />
          )}
          <div className="detail-info">
            <h1>{conference.title}</h1>
            <div className="meta-info">
              <p>Date: {formatDate(conference.date)}</p>
              <p>Time: {formatTime(conference.date)}{conference.endDate && <> – {formatTime(conference.endDate)}</>}</p>
              <p>Speaker: {conference.speaker?.name}</p>
              <p>Department: {conference.department}</p>
              <p>Attendees: {conference.attendeeCount}</p>
            </div>
            <span className={`status ${conference.status}`}>{conference.status}</span>
          </div>
        </div>

        {error && <ErrorMessage message={error} onClose={() => setError('')} />}

        <div className="tabs">
          <button
            className={`tab ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            Information
          </button>
          <button
            className={`tab ${activeTab === 'schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('schedule')}
          >
            Schedule
          </button>
          <button
            className={`tab ${activeTab === 'qa' ? 'active' : ''}`}
            onClick={() => setActiveTab('qa')}
          >
            Q&A
          </button>
          <button
            className={`tab ${activeTab === 'feedback' ? 'active' : ''}`}
            onClick={() => setActiveTab('feedback')}
          >
            Feedback ({feedback.length})
          </button>
        </div>

        <div className="tab-content">
          {activeTab === 'info' && (
            <div className="info-section">
              <h3>About</h3>
              <p>{conference.description}</p>

              {conference.speaker?.bio && (
                <>
                  <h3>Speaker</h3>
                  <p><strong>{conference.speaker.name}</strong></p>
                  <p>{conference.speaker.designation}</p>
                  <p>{conference.speaker.bio}</p>
                </>
              )}

              {conference.meetingLink && (
                <div className="meeting-section">
                  <h3>Join Meeting</h3>
                  <a href={conference.meetingLink} target="_blank" rel="noopener noreferrer" className="btn-join">
                    Join Now
                  </a>
                </div>
              )}
            </div>
          )}

          {activeTab === 'schedule' && (
            <div className="schedule-section">
              <h3>Schedule</h3>
              {conference.schedule && conference.schedule.length > 0 ? (
                <div className="schedule-list">
                  {conference.schedule.map((item, index) => (
                    <div key={index} className="schedule-item">
                      <div className="time">{item.time}</div>
                      <div className="activity">{item.activity}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p>No schedule available</p>
              )}
            </div>
          )}

          {activeTab === 'qa' && (
            <div className="qa-section">
              <h3>Live Q&A</h3>
              <div className="qa-input">
                <textarea
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Ask a question or share your thoughts..."
                  rows="3"
                />
                <button onClick={handlePostMessage}>Post Message</button>
              </div>

              <div className="qa-messages">
                {qaMessages.length === 0 ? (
                  <p>No messages yet. Be the first to ask!</p>
                ) : (
                  qaMessages.map((msg) => (
                    <div key={msg._id} className="qa-message">
                      <div className="message-header">
                        <strong>{msg.userId?.name || msg.userName || 'Guest'}</strong>
                        <span className="message-time">
                          {formatDateTime(msg.createdAt)}
                        </span>
                      </div>
                      <p className="message-content">{msg.message}</p>
                      <div className="message-stats">
                        <span>Likes: {msg.likes}</span>
                        {msg.isQuestion && <span className="badge">Question</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'feedback' && (
            <div className="feedback-section">
              <h3>Feedback & Ratings</h3>

              {averageRating > 0 && (
                <div className="feedback-stats">
                  <div className="rating-card">
                    <h4>Average Rating</h4>
                    <p className="big-rating">{averageRating} / 5</p>
                    <p>{feedback.length} responses</p>
                  </div>
                </div>
              )}

              {!showFeedbackForm && (
                <button onClick={() => setShowFeedbackForm(true)} className="btn-submit-feedback">
                  Submit Your Feedback
                </button>
              )}

              {showFeedbackForm && (
                <RatingForm onSubmit={handleSubmitFeedback} />
              )}

              <div className="feedback-list">
                {feedback.map((f) => (
                  <div key={f._id} className="feedback-item">
                    <div className="feedback-header">
                      <strong>{f.userId?.name}</strong>
                      <span className="rating">Rating: {f.rating} / 5</span>
                    </div>
                    {f.comment && <p>{f.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConferenceDetail;
