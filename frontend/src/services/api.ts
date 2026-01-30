import axios from 'axios';
import qs from 'qs';
import { toast } from 'sonner';

export const API_URL = process.env.NEXT_PUBLIC_API_URL;

export const api = axios.create({
  baseURL: API_URL,
  paramsSerializer: (params) =>
    qs.stringify(params, { arrayFormat: 'repeat' }),
});

api.interceptors.request.use((config) => {
  // Check both localStorage and sessionStorage for token
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');

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

// Response interceptor for handling 401 errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear tokens
      localStorage.removeItem('token');
      sessionStorage.removeItem('token');

      // Show error message
      toast.error('Sessão expirada. Por favor, faça login novamente.');

      // Redirect to login after a short delay
      setTimeout(() => {
        window.location.href = '/';
      }, 1500);
    }

    return Promise.reject(error);
  }
);
