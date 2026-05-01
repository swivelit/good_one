import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './AuthContext';
import AppVideoManager from './components/AppVideoManager';
import Navbar from './Navbar';
import Footer from './footer';
import HomePage from './pages/HomePage';
import MobileWelcomePage from './pages/MobileWelcomePage';
import LoginPage from './pages/loginpage';
import RegisterCustomer from './pages/RegisterConstomerpage';
import RegisterVendor from './pages/registervendor';
import ProductDetail from './pages/productDetail';
import ChatPage from './pages/ChatPage';
import VendorDashboard from './pages/VendorDashboard';
import VendorProfile from './pages/VendorProfile';
import AddProduct from './pages/addProduct';
import ProfilePage from './pages/ProfilePage';
import NotFound from './pages/NotFoundPage';
import PrivacyPolicy from './pages/PrivacyPolicy';
import AccountDeletionPage from './pages/AccountDeletionPage';

const Router = Capacitor.isNativePlatform() ? HashRouter : BrowserRouter;

const PrivateRoute = ({ children, role }) => {
  const { user, loading } = useAuth();
  if (loading) return <div className="d-flex justify-content-center align-items-center" style={{minHeight:'60vh'}}><div className="spinner-border text-warning" /></div>;
  if (!user) return <Navigate to="/login" />;
  if (role && user.role !== role) return <Navigate to="/" />;
  return children;
};

const NativeStartRoute = () => {
  const { user, loading } = useAuth();

  if (loading) return <div className="d-flex justify-content-center align-items-center" style={{minHeight:'60vh'}}><div className="spinner-border text-warning" /></div>;
  if (!Capacitor.isNativePlatform()) return <HomePage />;
  if (!user) return <MobileWelcomePage />;
  if (user.role === "vendor") return <Navigate to="/dashboard" replace />;
  return <HomePage />;
};

function AppRoutes() {
  const { user } = useAuth();
  const location = useLocation();
  const isNative = Capacitor.isNativePlatform();
  const hideNativeAuthChrome =
    isNative &&
    !user &&
    ["/", "/login", "/register/customer", "/register/vendor"].includes(location.pathname);

  return (
    <div className={isNative ? `native-app-shell ${user ? "native-with-bottom-nav" : ""}` : undefined}>
      {!hideNativeAuthChrome && <Navbar />}
      <Routes>
        <Route path="/" element={<NativeStartRoute />} />
        <Route path="/browse" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register/customer" element={<RegisterCustomer />} />
        <Route path="/register/vendor" element={<RegisterVendor />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/vendors/:id" element={<VendorProfile />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/account-deletion" element={<AccountDeletionPage />} />
        <Route path="/profile" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
        <Route path="/account" element={<PrivateRoute><ProfilePage /></PrivateRoute>} />
        <Route path="/chat" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
        <Route path="/chat/:conversationId" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
        <Route path="/dashboard" element={<PrivateRoute role="vendor"><VendorDashboard /></PrivateRoute>} />
        <Route path="/dashboard/add-product" element={<PrivateRoute role="vendor"><AddProduct /></PrivateRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      {!isNative && <Footer />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
        <AppVideoManager />
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
