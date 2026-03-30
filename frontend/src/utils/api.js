import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
 * Leaderboard API calls
 */
export const leaderboardAPI = {
  getLeaderboard: (params) => axios.get(`${API_URL}/leaderboard`, { params }),
  getUserPosition: (userId) => axios.get(`${API_URL}/leaderboard/user/${userId}`),
  getDepartmentLeaderboard: (department, params) =>
    axios.get(`${API_URL}/leaderboard/department/${department}`, { params }),
  getMyLeaderboard: () => axios.get(`${API_URL}/leaderboard/my`),
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
