import axios from 'axios';

export const API_URL = 'http://localhost:8000'; // ou sua URL de produção

export const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('🔗 Axios Request:', config.url);
    console.log('Headers:', config.headers);
  }

  return config;
});
