import axios from 'axios';
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
  return config;
});

export const authAPI = {
   sendOtp: (data) => API.post("/sendOtp", data),
    resendOtp: (data) => API.post("/resendOtp", data),
  registerCustomer: (data) => API.post('/auth/register/customer', data),
  registerVendor: (data) => API.post('/auth/register/vendor', data),
  login: (data) => API.post('/auth/login', data),
  getMe: () => API.get('/auth/me'),
  updateMe: (data) => API.put('/auth/me', data),
  deleteMe: () => API.delete('/auth/me'),
};

export const productAPI = {
  getAll: (params) => API.get('/products', { params }),
  getOne: (id) => API.get(`/products/${id}`),
  create: (data) => API.post('/products', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  update: (id, data) => API.put(`/products/${id}`, data),
  renew: (id) => API.put(`/products/${id}/renew`),
  delete: (id) => API.delete(`/products/${id}`),
  getMine: () => API.get('/products/my-products'),
  getByVendor: (vendorId) => API.get(`/products/vendor/${vendorId}`),
};

export const statsAPI = {
  getPublic: () => API.get('/stats/public'),
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
  getOne: (id) => API.get(`/vendors/${id}`),
  getMe: () => API.get('/vendors/me'),
  updateProfile: (data) => API.put('/vendors/profile', data),
};

export default API;
