import axios from 'axios';

// In development we use the CRA proxy (frontend/package.json -> "proxy")
// so use relative `/api` paths. In production, set `REACT_APP_API_URL`.
const API_URL = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL.replace(/\/$/, '')
  : '/api';

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
    let csrf = getCookie('X-CSRF-Token') || '';
    if (!csrf) {
      csrf = sessionStorage.getItem('csrfToken') || '';
    }
    if (csrf) {
      if (config.headers.set) {
        config.headers.set('X-CSRF-Token', csrf);
      } else {
        config.headers['X-CSRF-Token'] = csrf;
      }
    }
  }
  return config;
}, (error) => Promise.reject(error));

// Auto-retry mechanism for CSRF token expiration/missing
axios.interceptors.response.use(
  (response) => {
    const csrfToken = response.headers['x-csrf-token'] || response.headers['X-CSRF-Token'];
    if (csrfToken) {
      sessionStorage.setItem('csrfToken', csrfToken);
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // If we get a 403 CSRF token missing error and haven't retried yet
    if (
      error.response &&
      error.response.status === 403 &&
      error.response.data?.message?.includes('CSRF') &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
        // Fetch a fresh CSRF token (our backend now refreshes it on this endpoint)
        // Add timestamp to prevent browser from returning a cached response without the Set-Cookie header
        const retryRes = await axios.get(`${API_URL}/auth/me?t=${Date.now()}`, { _retry: true });
        
        const csrfToken = retryRes.headers['x-csrf-token'] || retryRes.headers['X-CSRF-Token'];
        if (csrfToken) {
          sessionStorage.setItem('csrfToken', csrfToken);
        }
        // Force the new CSRF token onto the retried request headers
        const newCsrf = csrfToken || sessionStorage.getItem('csrfToken') || '';
        if (newCsrf) {
          if (originalRequest.headers.set) {
            originalRequest.headers.set('X-CSRF-Token', newCsrf);
          } else {
            originalRequest.headers['X-CSRF-Token'] = newCsrf;
          }
        }
        
        // Retry the original request (the request interceptor will grab the new cookie)
        return axios(originalRequest);
      } catch (retryError) {
        return Promise.reject(retryError);
      }
    }
    
    return Promise.reject(error);
  }
);

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
  getDashboard: () => axios.get(`${API_URL}/staff/dashboard`, { withCredentials: true }),
};

/**
 * Admin API calls
 */
export const adminAPI = {
  getUsers: (params) => axios.get(`${API_URL}/admin/users`, { params }),
  updateUserRole: (id, role) => axios.put(`${API_URL}/admin/users/${id}/role`, { role }),
  deleteUser: (id) => axios.delete(`${API_URL}/admin/users/${id}`),
};
