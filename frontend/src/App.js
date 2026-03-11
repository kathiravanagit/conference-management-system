import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/ui/Toast';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import Home from './pages/Home/Home';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';
import ForgotPassword from './pages/Auth/ForgotPassword';
import ResetPassword from './pages/Auth/ResetPassword';
import ConfirmLogin from './pages/Auth/ConfirmLogin';
import Conferences from './pages/Conferences/Conferences';
import ConferenceDetail from './pages/Conferences/ConferenceDetail';
import VideoMeeting from './pages/Conferences/VideoMeeting';
import MyRegistrations from './pages/Dashboard/MyRegistrations';
import ParticipationDashboard from './pages/Dashboard/ParticipationDashboard';
import Leaderboard from './pages/Leaderboard/Leaderboard';
import TwoFactorSetup from './pages/Auth/TwoFactorSetup';
import QRCodePage from './pages/QR/QRCodePage';
import QRScanner from './pages/QR/QRScanner';
import CertificatePage from './pages/Certificates/CertificatePage';
import ProfileSettings from './pages/Profile/ProfileSettings';
import PasswordSettings from './pages/Profile/PasswordSettings';
import StaffDashboard from './pages/Dashboard/StaffDashboard';
import AdminUsers from './pages/Admin/AdminUsers';
import Meetings from './pages/Conferences/Meetings';
import VirtualAssistant from './components/widgets/VirtualAssistant';
import './App.css';

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return isAuthenticated ? children : <Navigate to="/login" />;
};

const StaffRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (!['admin', 'staff'].includes(user.role)) {
    return <Navigate to="/" />;
  }

  return children;
};

function AppContent() {
  return (
    <Router>
      <div className="app-layout">
        <Header />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/confirm-login" element={<ConfirmLogin />} />
            <Route path="/conferences" element={<Conferences />} />
            <Route path="/meetings" element={<Meetings />} />
            <Route path="/conference/:id" element={<ConferenceDetail />} />
            <Route
              path="/conference/:id/meeting"
              element={
                <ProtectedRoute>
                  <VideoMeeting />
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-registrations"
              element={
                <ProtectedRoute>
                  <MyRegistrations />
                </ProtectedRoute>
              }
            />
            <Route
              path="/participation"
              element={
                <ProtectedRoute>
                  <ParticipationDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/2fa-setup"
              element={
                <ProtectedRoute>
                  <TwoFactorSetup />
                </ProtectedRoute>
              }
            />
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <Navigate to="/account/profile" replace />
                </ProtectedRoute>
              }
            />
            <Route
              path="/account/profile"
              element={
                <ProtectedRoute>
                  <ProfileSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/account/password"
              element={
                <ProtectedRoute>
                  <PasswordSettings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/staff/dashboard"
              element={
                <StaffRoute>
                  <StaffDashboard />
                </StaffRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <StaffRoute>
                  <AdminUsers />
                </StaffRoute>
              }
            />
            <Route
              path="/qr/:registrationId"
              element={
                <ProtectedRoute>
                  <QRCodePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/scanner/:conferenceId"
              element={
                <ProtectedRoute>
                  <QRScanner />
                </ProtectedRoute>
              }
            />
            <Route
              path="/certificate/:certificateId"
              element={
                <ProtectedRoute>
                  <CertificatePage />
                </ProtectedRoute>
              }
            />
            <Route path="/leaderboard" element={<Leaderboard />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
        <Footer />
        <VirtualAssistant />
      </div>
    </Router>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AppContent />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
