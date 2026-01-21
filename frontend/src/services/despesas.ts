import { api } from './api';
import {
  Despesa,
  DespesaCreate,
  DespesaUpdate,
  DespesaListParams,
} from '@/types/despesas';

type PaginatedResponse<T> = {
  results: T[];
  count: number;
};

// 🔹 LISTAGEM
export async function getDespesas(params?: DespesaListParams) {
  const res = await api.get<PaginatedResponse<Despesa>>(
    '/api/despesas/',
    { params }
  );
  return res.data;
}

// 🔹 DESPESAS EM ABERTO
export async function getDespesasAbertas(params?: DespesaListParams) {
  const res = await api.get<PaginatedResponse<Despesa>>(
    '/api/despesas/',
    {
      params: {
        situacao: ['A', 'V'],
        ...params,
      },
    }
  );
  return res.data;
}

// 🔹 DESPESAS PAGAS
export async function getDespesasPagas(params?: DespesaListParams) {
  const res = await api.get<PaginatedResponse<Despesa>>(
    '/api/despesas/',
    {
      params: {
        situacao: 'P',
        ...params,
      },
    }
  );
  return res.data;
}

// 🔹 CREATE
export async function createDespesa(
  despesa: DespesaCreate
): Promise<Despesa> {
  const res = await api.post<Despesa>(
    '/api/despesas/',
    despesa
  );
  return res.data;
}

// 🔹 UPDATE
export async function updateDespesa(
  id: number,
  despesa: DespesaUpdate
): Promise<Despesa> {
  const res = await api.patch<Despesa>(
    `/api/despesas/${id}/`,
    despesa
  );
  return res.data;
}

// 🔹 DELETE
export async function deleteDespesa(id: number): Promise<void> {
  await api.delete(`/api/despesas/${id}/`);
}

// 🔹 GET BY ID
export async function getDespesaById(id: number): Promise<Despesa> {
  const res = await api.get<Despesa>(
    `/api/despesas/${id}/`
  );
  return res.data;
}
