import { api } from './api';

export interface LoginResponse {
  access: string;
  refresh: string;
}

export async function login(username: string, password: string, rememberMe: boolean = false): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/api/token/', {
    username,
    password,
  });

  const { access, refresh } = response.data;

  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem('token', access);
  storage.setItem('refresh_token', refresh);

  // Store the preference
  if (rememberMe) {
    localStorage.setItem('rememberMe', 'true');
  } else {
    localStorage.removeItem('rememberMe');
  }

  return { access, refresh };
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('rememberMe');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('refresh_token');
  window.location.href = '/';
}

export function isLoggedIn() {
  return !!getAccessToken();
}

export function getAccessToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

export function getRefreshToken() {
  return localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token');
}
