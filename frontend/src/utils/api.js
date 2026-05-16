import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Ensure cookies are sent with requests (httpOnly auth cookie, CSRF token cookie)
axios.defaults.withCredentials = true;

// Helper to read a cookie by name
function getCookie(name) {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  if (match) return decodeURIComponent(match[2]);
  return null;
}

// Attach CSRF token header for non-GET requests
axios.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase();
  if (!['get', 'head', 'options'].includes(method)) {
    const csrf = getCookie('X-CSRF-Token') || '';
    if (csrf) config.headers['X-CSRF-Token'] = csrf;
  }
  return config;
}, (error) => Promise.reject(error));

/**
 * Conference API calls
 */
export const conferenceAPI = {
  getAll: (params) => axios.get(`${API_URL}/conferences`, { params }),
  getById: (id) => axios.get(`${API_URL}/conferences/${id}`),
  create: (data) => axios.post(`${API_URL}/conferences`, data),
  update: (id, data) => axios.put(`${API_URL}/conferences/${id}`, data),
  delete: (id) => axios.delete(`${API_URL}/conferences/${id}`),
  authorizeMeetingJoin: (id, password) => axios.post(`${API_URL}/conferences/${id}/meeting-auth`, { password }),
  getRecordings: (id) => axios.get(`${API_URL}/conferences/${id}/recordings`),
  uploadRecording: (id, formData) => axios.post(`${API_URL}/conferences/${id}/recordings`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  uploadPoster: (id, file) => {
    const formData = new FormData();
    formData.append('poster', file);
    return axios.put(`${API_URL}/conferences/${id}/poster`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  getCompleted: () => axios.get(`${API_URL}/conferences/completed`),
};

/**
 * Registration API calls
 */
export const registrationAPI = {
  getMyRegistrations: () => axios.get(`${API_URL}/registrations/my`),
  getConferenceRegistrations: (conferenceId) =>
    axios.get(`${API_URL}/registrations/conference/${conferenceId}`),
  getConferenceStats: (conferenceId) =>
    axios.get(`${API_URL}/registrations/conference/${conferenceId}/stats`),
  getById: (id) => axios.get(`${API_URL}/registrations/${id}`),
  register: (conferenceId) => axios.post(`${API_URL}/registrations`, { conferenceId }),
  cancel: (id) => axios.delete(`${API_URL}/registrations/${id}`),
};

/**
 * Certificate API calls
 */
export const certificateAPI = {
  generateCertificate: (registrationId) =>
    axios.post(`${API_URL}/certificates/generate/${registrationId}`),
  getMyCertificates: () => axios.get(`${API_URL}/certificates/my`),
  downloadCertificate: (id) =>
    axios.get(`${API_URL}/certificates/${id}/download`, {
      responseType: 'blob',
    }),
  getAllCertificates: () => axios.get(`${API_URL}/certificates`),
  uploadCertificate: (data) =>
    axios.post(`${API_URL}/certificates/upload`, data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
};

/**
 * Feedback API calls
 */
export const feedbackAPI = {
  submitFeedback: (data) => axios.post(`${API_URL}/feedback`, data),
  getConferenceFeedback: (conferenceId) =>
    axios.get(`${API_URL}/feedback/conference/${conferenceId}`),
  getMyFeedback: () => axios.get(`${API_URL}/feedback/my`),
  updateFeedback: (id, data) => axios.put(`${API_URL}/feedback/${id}`, data),
  deleteFeedback: (id) => axios.delete(`${API_URL}/feedback/${id}`),
};

/**
 * Analytics API calls
 */
export const analyticsAPI = {
  getOverview: (params) => axios.get(`${API_URL}/analytics`, { params }),
  getAttendanceStats: (params) => axios.get(`${API_URL}/analytics/attendance`, { params }),
  getPopularConferences: (params) =>
    axios.get(`${API_URL}/analytics/popular`, { params }),
  getAttendanceTrends: (params) => axios.get(`${API_URL}/analytics/trends`, { params }),
  getCategoryBreakdown: (params) =>
    axios.get(`${API_URL}/analytics/categories`, { params }),
  getUserParticipation: (params) =>
    axios.get(`${API_URL}/analytics/user-participation`, { params }),
};

/**
 * Attendance API calls
 */
export const attendanceAPI = {
  markAttendance: (data) => axios.post(`${API_URL}/attendance/mark`, data),
  getMyAttendance: () => axios.get(`${API_URL}/attendance/my`),
  getConferenceAttendance: (conferenceId) =>
    axios.get(`${API_URL}/attendance/conference/${conferenceId}`),
  exportAttendance: (conferenceId) =>
    axios.get(`${API_URL}/attendance/conference/${conferenceId}/export`, {
      responseType: 'blob',
    }),
};

/**
 * Q&A API calls
 */
export const qaAPI = {
  getMessages: (conferenceId, params) =>
    axios.get(`${API_URL}/qa/${conferenceId}`, { params }),
  postMessage: (data) => axios.post(`${API_URL}/qa`, data),
  likeMessage: (id) => axios.put(`${API_URL}/qa/${id}/like`),
  replyToMessage: (id, message) => axios.post(`${API_URL}/qa/${id}/reply`, { message }),
  deleteMessage: (id) => axios.delete(`${API_URL}/qa/${id}`),
};

/**
 * Staff API calls
 */
export const staffAPI = {
  getDashboard: () => axios.get(`${API_URL}/staff/dashboard`),
};

/**
 * Admin API calls
 */
export const adminAPI = {
  getUsers: (params) => axios.get(`${API_URL}/admin/users`, { params }),
  updateUserRole: (id, role) => axios.put(`${API_URL}/admin/users/${id}/role`, { role }),
  deleteUser: (id) => axios.delete(`${API_URL}/admin/users/${id}`),
};
