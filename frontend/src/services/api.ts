import axios from 'axios';
import qs from 'qs';

export const API_URL = 'http://localhost:8000'; // ou sua URL de produção

export const api = axios.create({
  baseURL: API_URL,
  paramsSerializer: (params) =>
    qs.stringify(params, { arrayFormat: 'repeat' }),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('🔗 Axios Request:', config.url);
    console.log('Headers:', config.headers);
    console.log('Params:', config.params);
  }

  return config;
});
