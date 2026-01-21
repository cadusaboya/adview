import { api } from './api';

export interface LoginResponse {
  access: string;
  refresh: string;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/api/token/', {
    username,
    password,
  });

  const { access, refresh } = response.data;

  localStorage.setItem('token', access);
  localStorage.setItem('refresh_token', refresh);

  return { access, refresh };
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  window.location.href = '/'; // ou redireciona pra onde quiser
}

export function isLoggedIn() {
  return !!localStorage.getItem('token');
}

export function getAccessToken() {
  return localStorage.getItem('token');
}

export function getRefreshToken() {
  return localStorage.getItem('refresh_token');
}
