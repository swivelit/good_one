import axios from 'axios';

const API = axios.create({ 
  baseURL: 'http://localhost:5000/api'
});

API.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export const authAPI = {
   sendOtp: (data) => API.post("/sendOtp", data),
    resendOtp: (data) => API.post("/resendOtp", data),
  registerCustomer: (data) => API.post('/auth/register/customer', data),
  registerVendor: (data) => API.post('/auth/register/vendor', data),
  login: (data) => API.post('/auth/login', data),
  getMe: () => API.get('/auth/me'),
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

export const chatAPI = {
  getOrCreate: (productId) => API.post('/chat/conversation', { productId }),
  getConversations: () => API.get('/chat/conversations'),
  getMessages: (convId) => API.get(`/chat/${convId}/messages`),
  sendMessage: (convId, data) => API.post(`/chat/${convId}/messages`, data),
};

export const vendorAPI = {
  getAll: () => API.get('/vendors'),
  getOne: (id) => API.get(`/vendors/${id}`),
  getMe: () => API.get('/vendors/me'),
  updateProfile: (data) => API.put('/vendors/profile', data),
};

export default API;