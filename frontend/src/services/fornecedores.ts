import { api } from './api';
import {
  Fornecedor,
  FornecedorCreate,
  FornecedorUpdate,
} from '@/types/fornecedores';

export async function getFornecedores(params?: { page?: number; page_size?: number; search?: string; ordering?: string }) {
  const res = await api.get<{ results: Fornecedor[]; count: number }>('/api/fornecedores/', {
    params,
  });
  return res.data;
}

export async function createFornecedor(fornecedor: FornecedorCreate) {
  const res = await api.post<Fornecedor>('/api/fornecedores/', fornecedor);
  return res.data;
}

export async function updateFornecedor(id: number, fornecedor: FornecedorUpdate) {
  const res = await api.patch<Fornecedor>(`/api/fornecedores/${id}/`, fornecedor);
  return res.data;
}

export async function deleteFornecedor(id: number) {
  const res = await api.delete(`/api/fornecedores/${id}/`);
  return res.data;
}
