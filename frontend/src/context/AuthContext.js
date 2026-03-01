import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

axios.defaults.baseURL = process.env.REACT_APP_API_URL ? process.env.REACT_APP_API_URL.replace(/\/api\/?$/, '') : 'http://localhost:5000';

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
  const [token, setToken] = useState(localStorage.getItem('token'));

  // Setup axios default headers
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, [token]);

  // Check if user is logged in on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (token) {
        try {
          const response = await axios.get('/api/auth/me');
          setUser(response.data.user);
        } catch (error) {
          setToken(null);
          localStorage.removeItem('token');
        }
      }
      setLoading(false);
    };

    checkAuth();
  }, [token]);

  const login = async (email, password, rememberMe = true) => {
    try {
      const response = await axios.post('/api/auth/login', { email, password, rememberMe });
      if (response.data.confirmationRequired) {
        return response.data;
      }

      if (response.data.requires2FA) {
        return response.data;
      }

      setToken(response.data.token);
      setUser(response.data.user);
      localStorage.setItem('token', response.data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
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

      setToken(response.data.token);
      setUser(response.data.user);
      localStorage.setItem('token', response.data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
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

      setToken(response.data.token);
      setUser(response.data.user);
      localStorage.setItem('token', response.data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
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

      setToken(response.data.token);
      setUser(response.data.user);
      localStorage.setItem('token', response.data.token);
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
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

  const logout = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
    delete axios.defaults.headers.common['Authorization'];
  };

  const value = {
    user,
    token,
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
    isAuthenticated: !!token,
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'staff',
    canManageEvents: ['admin', 'staff'].includes(user?.role),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
