import { api } from './api';
import { Receita } from '@/types/receitas';
import { ReceitaCreate, ReceitaUpdate } from '@/types/receitas';

/* =========================
   LIST PARAMS
========================= */

export interface ReceitaListParams {
  page?: number;
  page_size?: number;
  search?: string;
  ordering?: string;

  situacao?: string | string[];
  start_date?: string; // YYYY-MM-DD
  end_date?: string;   // YYYY-MM-DD
  funcionario_id?: number;
}

/* =========================
   GET GENÉRICO
========================= */

export async function getReceitas(params?: ReceitaListParams) {
  const res = await api.get<{ results: Receita[]; count: number }>(
    '/api/receitas/',
    { params }
  );
  return res.data;
}

/* =========================
   RECEITAS EM ABERTO
========================= */

export async function getReceitasAbertas(params?: ReceitaListParams) {
  const res = await api.get<{ results: Receita[]; count: number }>(
    '/api/receitas/',
    {
      params: {
        ...params,
        situacao: ['A', 'V'],
      },
    }
  );
  return res.data;
}

/* =========================
   RECEITAS RECEBIDAS
========================= */

export async function getReceitasRecebidas(params?: ReceitaListParams) {
  const res = await api.get<{ results: Receita[]; count: number }>(
    '/api/receitas/',
    {
      params: {
        ...params,
        situacao: 'P',
      },
    }
  );
  return res.data;
}

/* =========================
   CRUD
========================= */

export async function createReceita(data: ReceitaCreate) {
  const res = await api.post<Receita>('/api/receitas/', data);
  return res.data;
}

export async function updateReceita(
  id: number,
  data: ReceitaUpdate
) {
  const res = await api.patch<Receita>(
    `/api/receitas/${id}/`,
    data
  );
  return res.data;
}

export async function deleteReceita(id: number) {
  await api.delete(`/api/receitas/${id}/`);
}

/* =========================
   GET BY ID
========================= */

export async function getReceitaById(id: number) {
  const res = await api.get<Receita>(`/api/receitas/${id}/`);
  return res.data;
}
