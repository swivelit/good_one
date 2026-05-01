import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI } from './api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [vendorProfile, setVendorProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      authAPI.getMe()
        .then(({ data }) => {
          setUser(data.user);
          setVendorProfile(data.vendorProfile);
        })
        .catch(() => localStorage.removeItem('token'))
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = (token, userData, vendor = null) => {
    localStorage.setItem('token', token);
    setUser(userData);
    setVendorProfile(vendor);
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setVendorProfile(null);
  };

  const updateUser = (userData) => {
    setUser((current) => ({ ...(current || {}), ...(userData || {}) }));
  };

  return (
    <AuthContext.Provider value={{ user, vendorProfile, setVendorProfile, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
