import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

// In development rely on the CRA proxy (set in frontend/package.json) so requests
// are same-origin and cookies (including CSRF cookie) are accepted by the browser.
axios.defaults.baseURL = process.env.REACT_APP_API_URL
  ? process.env.REACT_APP_API_URL.replace(/\/$/, '')
  : '';
axios.defaults.withCredentials = true;

// Automatically attach CSRF token cookie value as header on all state-changing requests.
// The backend sets the X-CSRF-Token cookie after login; we just read it and mirror it
// as a header (Double Submit Cookie pattern — stateless, survives server restarts).
axios.interceptors.request.use((config) => {
  const method = (config.method || '').toLowerCase();
  if (['post', 'put', 'delete', 'patch'].includes(method)) {
    const csrfCookie = document.cookie
      .split(';')
      .find((c) => c.trim().startsWith('X-CSRF-Token='));
    if (csrfCookie) {
      const csrfToken = decodeURIComponent(csrfCookie.split('=')[1]?.trim() || '');
      if (csrfToken) {
        if (config.headers.set) {
          config.headers.set('X-CSRF-Token', csrfToken);
        } else {
          config.headers['X-CSRF-Token'] = csrfToken;
        }
      }
    }
  }
  return config;
});

// Auto-retry mechanism for CSRF token expiration/missing
axios.interceptors.response.use(
  (response) => response,
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
        await axios.get(`/api/auth/me?t=${Date.now()}`, { _retry: true });
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
        const response = await axios.get('/api/auth/me');
        setUser(response.data.user);
      } catch (error) {
        // Not authenticated
      }
      setLoading(false);
    };

    checkAuth();
  }, []);

  const login = async (email, password, rememberMe = true) => {
    try {
      const response = await axios.post('/api/auth/login', { email, password, rememberMe });
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
      const response = await axios.post('/api/auth/google', { credential });
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
      const response = await axios.post('/api/auth/register', {
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
      const response = await axios.get(`/api/auth/confirm-login?token=${token}`);
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
      const response = await axios.post('/api/auth/verify-2fa', payload, {
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
      const response = await axios.post('/api/auth/forgot-password', { email });
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const resetPassword = async (email, otp, newPassword) => {
    try {
      const response = await axios.post('/api/auth/reset-password', {
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
      const response = await axios.put('/api/auth/updateprofile', profileData);
      setUser(response.data.user);
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const changePassword = async (currentPassword, newPassword) => {
    try {
      const response = await axios.put('/api/auth/change-password', {
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
      const response = await axios.delete('/api/auth/delete-account', {
        data: { password }
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
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
