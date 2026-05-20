import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL.replace(/\/$/, '')
  : '/api';

axios.defaults.withCredentials = true;

// Automatically attach CSRF token cookie value as header on all state-changing requests.
axios.interceptors.request.use((config) => {
  const method = (config.method || '').toLowerCase();
  if (['post', 'put', 'delete', 'patch'].includes(method)) {
    const csrfCookie = document.cookie
      .split(';')
      .find((c) => c.trim().startsWith('X-CSRF-Token='));
    let csrfToken = '';
    if (csrfCookie) {
      csrfToken = decodeURIComponent(csrfCookie.split('=')[1]?.trim() || '');
    }
    if (!csrfToken) {
      csrfToken = sessionStorage.getItem('csrfToken') || '';
    }
    if (csrfToken) {
      if (config.headers.set) {
        config.headers.set('X-CSRF-Token', csrfToken);
      } else {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
    }
  }
  return config;
});

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
    if (
      error.response &&
      error.response.status === 403 &&
      error.response.data?.message?.includes('CSRF') &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;
      try {
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
        return axios(originalRequest);
      } catch (retryError) {
        return Promise.reject(retryError);
      }
    }
    return Promise.reject(error);
  }
);

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await axios.get(`${API_URL}/auth/me`);
        setUser(response.data.user);
      } catch (error) {
        // Not authenticated
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email, password, role, rememberMe = true) => {
    try {
      const response = await axios.post(`${API_URL}/auth/login`, { email, password, role, rememberMe });
      if (response.data.confirmationRequired) {
        return response.data;
      }

      if (response.data.requires2FA) {
        return response.data;
      }

      setUser(response.data.user);
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const googleLogin = async (credential) => {
    try {
      const response = await axios.post(`${API_URL}/auth/google`, { credential });
      if (response.data.requires2FA) {
        return response.data;
      }

      setUser(response.data.user);
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const register = async (name, email, password, department, role) => {
    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        name,
        email,
        password,
        department,
        role,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const confirmLogin = async (token) => {
    try {
      const response = await axios.get(`${API_URL}/auth/confirm-login?token=${token}`);
      if (response.data.requires2FA) {
        return response.data;
      }

      setUser(response.data.user);
      return response.data.user;
    } catch (error) {
      throw error;
    }
  };

  const verifyTwoFactor = async (pendingToken, code, backupCode) => {
    try {
      const payload = backupCode ? { backupCode } : { token: code };
      const response = await axios.post(`${API_URL}/auth/verify-2fa`, payload, {
        headers: {
          Authorization: `Bearer ${pendingToken}`,
        },
      });

      setUser(response.data.user);
      return response.data.user;
    } catch (error) {
      throw error;
    }
  };

  const requestPasswordReset = async (email) => {
    try {
      const response = await axios.post(`${API_URL}/auth/forgot-password`, { email });
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const resetPassword = async (email, otp, newPassword) => {
    try {
      const response = await axios.post(`${API_URL}/auth/reset-password`, {
        email,
        otp,
        newPassword,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const updateProfile = async (profileData) => {
    try {
      const response = await axios.put(`${API_URL}/auth/updateprofile`, profileData);
      setUser(response.data.user);
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await axios.put(`${API_URL}/auth/change-password`, {
        currentPassword,
        newPassword,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const deleteAccount = async (password) => {
    try {
      const response = await axios.delete(`${API_URL}/auth/delete-account`, {
        data: { password }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`);
    } catch (error) {
      console.error('Logout error:', error);
    }
    setUser(null);
  };

  const value = {
    user,
    loading,
    login,
    googleLogin,
    register,
    confirmLogin,
    verifyTwoFactor,
    requestPasswordReset,
    resetPassword,
    updateProfile,
    changePassword,
    deleteAccount,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'staff',
    canManageEvents: ['admin', 'staff'].includes(user?.role),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
