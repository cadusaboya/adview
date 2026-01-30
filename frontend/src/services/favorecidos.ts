import { api } from './api';

export async function getFavorecidos(params?: {
  page?: number;
  page_size?: number;
}) {
  const res = await api.get('/api/favorecidos/', { params });
  return res.data;
}
