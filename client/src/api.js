import axios from 'axios';
import { Capacitor } from '@capacitor/core';
import { API_URL } from './config';

const VIEWER_ID_KEY = 'goodone_viewer_id';

const createViewerId = () => {
  const cryptoRef = typeof window !== 'undefined' ? window.crypto : null;
  if (cryptoRef?.randomUUID) return cryptoRef.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
};

const getViewerId = () => {
  if (typeof window === 'undefined' || !window.localStorage) return null;

  try {
    const existing = window.localStorage.getItem(VIEWER_ID_KEY);
    if (existing) return existing;

    const viewerId = createViewerId();
    window.localStorage.setItem(VIEWER_ID_KEY, viewerId);
    return viewerId;
  } catch (error) {
    return null;
  }
};

const isNativeApp = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

const addNativeAppHeaders = (headers) => {
  if (!isNativeApp()) return;

  const platform = Capacitor.getPlatform();
  if (platform) headers['X-App-Platform'] = platform;
  if (process.env.REACT_APP_ANDROID_VERSION_CODE) {
    headers['X-App-Version-Code'] = process.env.REACT_APP_ANDROID_VERSION_CODE;
  }
  if (process.env.REACT_APP_ANDROID_VERSION_NAME) {
    headers['X-App-Version-Name'] = process.env.REACT_APP_ANDROID_VERSION_NAME;
  }
};

const API = axios.create({ 
  baseURL: API_URL
});

API.interceptors.request.use((config) => {
  let token = null;
  try {
    token = localStorage.getItem('token');
  } catch (error) {
    token = null;
  }
  const viewerId = getViewerId();

  config.headers = config.headers || {};
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (viewerId) config.headers['X-Viewer-Id'] = viewerId;
  addNativeAppHeaders(config.headers);
  return config;
});

API.interceptors.response.use(
  (response) => response,
  (error) => {
    const response = error?.response;
    if (
      response?.status === 426 &&
      response?.data?.code === 'UPDATE_REQUIRED' &&
      typeof window !== 'undefined'
    ) {
      window.dispatchEvent(new CustomEvent('goodone:update-required', {
        detail: response.data,
      }));
    }

    return Promise.reject(error);
  },
);

export const authAPI = {
   sendOtp: (data) => API.post("/sendOtp", data),
    resendOtp: (data) => API.post("/resendOtp", data),
  registerCustomer: (data) => API.post('/auth/register/customer', data),
  registerVendor: (data) => API.post('/auth/register/vendor', data),
  login: (data) => API.post('/auth/login', data),
  requestPasswordResetOtp: (data) => API.post('/auth/forgot-password/send-otp', data),
  resetPassword: (data) => API.post('/auth/forgot-password/reset', data),
  getMe: () => API.get('/auth/me'),
  updateMe: (data) => API.put('/auth/me', data),
  deleteMe: () => API.delete('/auth/me'),
  registerPushToken: (data) => API.post('/auth/push-token', data),
  deletePushToken: (data) => API.delete('/auth/push-token', { data }),
};

export const productAPI = {
  getAll: (params) => API.get('/products', { params }),
  getLocations: () => API.get('/products/locations'),
  getOne: (id) => API.get(`/products/${id}`),
  create: (data) => API.post('/products', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, data) => API.put(`/products/${id}`, data),
  renew: (id, body = {}) => API.put(`/products/${id}/renew`, body),
  delete: (id) => API.delete(`/products/${id}`),
  getMine: () => API.get('/products/my-products'),
  getByVendor: (vendorId) => API.get(`/products/vendor/${vendorId}`),
};

export const statsAPI = {
  getPublic: () => API.get('/stats/public'),
};

export const appConfigAPI = {
  get: (params) => API.get('/app-config', { params }),
};

export const chatAPI = {
  getOrCreate: (productId) => API.post('/chat/conversation', { productId }),
  getConversations: () => API.get('/chat/conversations'),
  getMessages: (convId) => API.get(`/chat/${convId}/messages`),
  sendMessage: (convId, data) => API.post(`/chat/${convId}/messages`, data),
};

export const reportAPI = {
  create: (data) => API.post('/reports', data),
};

export const blockAPI = {
  blockUser: (data) => API.post('/blocks', data),
};

export const vendorAPI = {
  getAll: () => API.get('/vendors'),
  getAllAdmin: () => API.get('/vendors/admin/all'),
  getAdminOne: (id) => API.get(`/vendors/admin/${id}`),
  updateAdminProfile: (id, data) => API.put(`/vendors/admin/${id}/profile`, data),
  getOne: (id) => API.get(`/vendors/${id}`),
  getMe: () => API.get('/vendors/me'),
  updateProfile: (data) => API.put('/vendors/profile', data),
};

export default API;
