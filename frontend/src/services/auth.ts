import { api } from './api';

export interface LoginResponse {
  access: string;
  refresh: string;
}

export function saveAuthTokens(
  tokens: LoginResponse,
  rememberMe: boolean = false
) {
  const { access, refresh } = tokens;
  const storage = rememberMe ? localStorage : sessionStorage;
  storage.setItem('token', access);
  storage.setItem('refresh_token', refresh);

  if (rememberMe) {
    localStorage.setItem('rememberMe', 'true');
  } else {
    localStorage.removeItem('rememberMe');
  }
}

export async function login(username: string, password: string, rememberMe: boolean = false): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/api/token/', {
    username,
    password,
  });

  const { access, refresh } = response.data;
  saveAuthTokens({ access, refresh }, rememberMe);

  return { access, refresh };
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('rememberMe');
  sessionStorage.removeItem('token');
  sessionStorage.removeItem('refresh_token');
  sessionStorage.removeItem('vincor_assinatura_cache');
  window.location.href = '/';
}

export interface RegisterPayload {
  nome_empresa: string;
  cpf_cnpj: string;
  username: string;
  email: string;
  senha: string;
  nome?: string;
}

export async function register(payload: RegisterPayload): Promise<void> {
  await api.post('/api/register/', payload);
}

export async function verifyEmail(uid: string, token: string): Promise<LoginResponse> {
  const response = await api.post<LoginResponse>('/api/verify-email/', { uid, token });
  return response.data;
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/api/password-reset/', { email });
}

export async function confirmPasswordReset(uid: string, token: string, password: string): Promise<void> {
  await api.post('/api/password-reset/confirm/', { uid, token, password });
}

/**
 * Retorna true apenas se existe um access token E ele ainda não expirou
 * (baseado no campo `exp` do JWT). Se o token existir mas estiver expirado,
 * remove-o do storage para evitar loops de auto-login.
 */
export function isLoggedIn() {
  const token = getAccessToken();
  if (!token) return false;

  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
    const expMs = typeof payload?.exp === 'number' ? payload.exp * 1000 : 0;
    if (expMs && expMs <= Date.now()) {
      // Token expirado: limpa storage e sinaliza deslogado
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('refresh_token');
      return false;
    }
  } catch {
    // Token malformado: trata como deslogado
    return false;
  }

  return true;
}

export function getAccessToken() {
  return localStorage.getItem('token') || sessionStorage.getItem('token');
}

export function getRefreshToken() {
  return localStorage.getItem('refresh_token') || sessionStorage.getItem('refresh_token');
}
