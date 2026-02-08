import { api } from './api';
import type {
  Allocation,
  AllocationCreate,
  AllocationUpdate,
  AllocationListParams
} from '@/types/allocations';

// =========================
// LISTAR ALOCAÇÕES
// =========================
export async function getAllocations(params?: AllocationListParams) {
  const { data } = await api.get<{
    count: number;
    next: string | null;
    previous: string | null;
    results: Allocation[];
  }>('/api/alocacoes/', { params });

  return data;
}

// =========================
// OBTER UMA ALOCAÇÃO
// =========================
export async function getAllocation(id: number): Promise<Allocation> {
  const { data } = await api.get<Allocation>(`/api/alocacoes/${id}/`);
  return data;
}

// =========================
// CRIAR ALOCAÇÃO
// =========================
export async function createAllocation(
  allocation: AllocationCreate
): Promise<Allocation> {
  const { data } = await api.post<Allocation>('/api/alocacoes/', allocation);
  return data;
}

// =========================
// ATUALIZAR ALOCAÇÃO
// =========================
export async function updateAllocation(
  id: number,
  allocation: AllocationUpdate
): Promise<Allocation> {
  const { data } = await api.put<Allocation>(`/api/alocacoes/${id}/`, allocation);
  return data;
}

// =========================
// DELETAR ALOCAÇÃO
// =========================
export async function deleteAllocation(id: number): Promise<void> {
  await api.delete(`/api/alocacoes/${id}/`);
}
