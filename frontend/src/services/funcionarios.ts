import { api } from './api';
import {
  Funcionario,
  FuncionarioCreate,
  FuncionarioUpdate,
} from '@/types/funcionarios';

export async function getFuncionarios(params?: {
  page?: number;
  page_size?: number;
}) {
  const res = await api.get<{
    results: Funcionario[];
    count: number;
  }>('/api/funcionarios/', { params });

  return res.data;
}

// ✅ CREATE → payload fechado
export async function createFuncionario(
  funcionario: FuncionarioCreate
) {
  const res = await api.post<Funcionario>(
    '/api/funcionarios/',
    funcionario
  );
  return res.data;
}

// ✅ UPDATE → payload parcial
export async function updateFuncionario(
  id: number,
  funcionario: FuncionarioUpdate
) {
  const res = await api.patch<Funcionario>(
    `/api/funcionarios/${id}/`,
    funcionario
  );
  return res.data;
}

export async function deleteFuncionario(id: number) {
  await api.delete(`/api/funcionarios/${id}/`);
}
