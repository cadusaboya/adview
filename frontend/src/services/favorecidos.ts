import { api } from './api';
import { Favorecido } from '@/types/favorecidos';

export async function getFavorecidos(params?: {
  page?: number;
  page_size?: number;
}) {
  const res = await api.get('/api/favorecidos/', { params });
  return res.data;
}

export async function createFavorecido(data: {
  nome: string;
  tipo: 'F' | 'P' | 'O';
}): Promise<Favorecido> {
  const res = await api.post<Favorecido>('/api/favorecidos/', data);
  return res.data;
}
