import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { ToastProvider } from './components/ui/Toast';
import Header from './components/layout/Header';
import Footer from './components/layout/Footer';
import './App.css';

const Home = lazy(() => import('./pages/Home/Home'));
const Login = lazy(() => import('./pages/Auth/Login'));
const Register = lazy(() => import('./pages/Auth/Register'));
const ForgotPassword = lazy(() => import('./pages/Auth/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/Auth/ResetPassword'));
const ConfirmLogin = lazy(() => import('./pages/Auth/ConfirmLogin'));
const Conferences = lazy(() => import('./pages/Conferences/Conferences'));
const ConferenceDetail = lazy(() => import('./pages/Conferences/ConferenceDetail'));
const VideoMeeting = lazy(() => import('./pages/Conferences/VideoMeeting'));
const MyRegistrations = lazy(() => import('./pages/Dashboard/MyRegistrations'));
const ParticipationDashboard = lazy(() => import('./pages/Dashboard/ParticipationDashboard'));
const TwoFactorSetup = lazy(() => import('./pages/Auth/TwoFactorSetup'));
const QRCodePage = lazy(() => import('./pages/QR/QRCodePage'));
const QRScanner = lazy(() => import('./pages/QR/QRScanner'));
const CertificatePage = lazy(() => import('./pages/Certificates/CertificatePage'));
const ProfileSettings = lazy(() => import('./pages/Profile/ProfileSettings'));
const PasswordSettings = lazy(() => import('./pages/Profile/PasswordSettings'));
const StaffDashboard = lazy(() => import('./pages/Dashboard/StaffDashboard'));
const AdminUsers = lazy(() => import('./pages/Admin/AdminUsers'));
const Meetings = lazy(() => import('./pages/Conferences/Meetings'));
const VirtualAssistant = lazy(() => import('./components/widgets/VirtualAssistant'));

const RouteFallback = () => <div className="loading">Loading...</div>;

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (isAuthenticated) {
    return children;
  }

  const redirectTarget = `${location.pathname}${location.search}`;
  return <Navigate to={`/login?redirect=${encodeURIComponent(redirectTarget)}`} replace />;
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

// Redirects already-logged-in users away from auth pages (login, register, etc.)
const GuestRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  if (isAuthenticated) {
    return <Navigate to="/conferences" replace />;
  }

  return children;
};

function AppContent() {
  return (
    <Router>
      <div className="app-layout">
        <Header />
        <main className="app-main">
          <Suspense fallback={<RouteFallback />}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
              <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />
              <Route path="/forgot-password" element={<GuestRoute><ForgotPassword /></GuestRoute>} />
              <Route path="/reset-password" element={<GuestRoute><ResetPassword /></GuestRoute>} />
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
              {/* Analytics route removed for student users */}
              <Route path="*" element={<Navigate to="/" />} />
            </Routes>
          </Suspense>
        </main>
        <Footer />
        <Suspense fallback={null}>
          <VirtualAssistant />
        </Suspense>
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
