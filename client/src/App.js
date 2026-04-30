import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Capacitor } from '@capacitor/core';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './AuthContext';
import Navbar from './Navbar';
import Footer from './footer';
import HomePage from './pages/HomePage';
import LoginPage from './pages/loginpage';
import RegisterCustomer from './pages/RegisterConstomerpage';
import RegisterVendor from './pages/registervendor';
import ProductDetail from './pages/productDetail';
import ChatPage from './pages/ChatPage';
import VendorDashboard from './pages/VendorDashboard';
import VendorProfile from './pages/VendorProfile';
import AddProduct from './pages/addProduct';
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

function AppRoutes() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register/customer" element={<RegisterCustomer />} />
        <Route path="/register/vendor" element={<RegisterVendor />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/vendors/:id" element={<VendorProfile />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/account-deletion" element={<AccountDeletionPage />} />
        <Route path="/chat" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
        <Route path="/chat/:conversationId" element={<PrivateRoute><ChatPage /></PrivateRoute>} />
        <Route path="/dashboard" element={<PrivateRoute role="vendor"><VendorDashboard /></PrivateRoute>} />
        <Route path="/dashboard/add-product" element={<PrivateRoute role="vendor"><AddProduct /></PrivateRoute>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Toaster position="top-right" toastOptions={{ duration: 3500 }} />
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
