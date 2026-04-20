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
      const url = error.config?.url ?? '';
      // Ignore 401 from the login endpoint — the page handles those messages itself
      if (!url.includes('/api/token/')) {
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('refresh_token');
        const currentPath =
          typeof window !== 'undefined' ? window.location.pathname : '';
        if (currentPath !== '/') {
          toast.error('Sessão expirada. Por favor, faça login novamente.');
          window.location.href = '/';
        }
      }
    }

    // Subscription expired or inactive → redirect based on subscription status
    if (error.response?.status === 402) {
      const currentPath = typeof window !== 'undefined' ? window.location.pathname : '';
      const exemptPaths = ['/assinar', '/assinatura'];
      if (!exemptPaths.includes(currentPath)) {
        // Read cached status to decide where to send the user:
        // - payment_failed / overdue → /assinatura (update card or pay pending charge)
        // - everything else (trial expired, cancelled) → /assinar (pick a plan)
        let cachedStatus: string | null = null;
        try {
          const raw = sessionStorage.getItem('vincor_assinatura_cache');
          if (raw) cachedStatus = JSON.parse(raw)?.status ?? null;
        } catch {
          // ignore
        }
        const manageStatuses = ['payment_failed', 'overdue'];
        window.location.href = manageStatuses.includes(cachedStatus ?? '')
          ? '/assinatura'
          : '/assinar';
      }
    }

    return Promise.reject(error);
  }
);
