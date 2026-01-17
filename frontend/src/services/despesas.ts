import { api } from './api';

export interface Despesa {
  id: number;
  nome: string;
  descricao: string;
  responsavel_id: number;
  responsavel: {
    id: number;
    nome: string;
  };
  data_vencimento: string;
  data_pagamento: string | null;
  valor: string;
  valor_pago: string | null;
  tipo: 'F' | 'V' | 'C' | 'R';
  situacao: 'A' | 'P' | 'V';
  tipo_display: string;
  situacao_display: string;
}

export async function getDespesasAbertas(params?: { page?: number; page_size?: number }) {
  const res = await api.get<{ results: Despesa[]; count: number }>('/api/despesas/', {
    params: { situacao: ['A', 'V'], ...params },
  });
  return res.data;
}

export async function getDespesasPagas(params?: { page?: number; page_size?: number }) {
  const res = await api.get<{ results: Despesa[]; count: number }>('/api/despesas/', {
    params: { situacao: 'P', ...params },
  });
  return res.data;
}

export async function updateDespesa(
  id: number,
  despesa: Partial<Omit<Despesa, 'id' | 'responsavel' | 'tipo_display' | 'situacao_display'>>
) {
  const res = await api.patch<Despesa>(`/api/despesas/${id}/`, despesa);
  return res.data;
}


export async function createDespesa(
  despesa: Omit<Despesa, 'id' | 'responsavel' | 'tipo_display' | 'situacao_display'>
) {
  const res = await api.post<Despesa>('/api/despesas/', despesa);
  return res.data;
}

export async function deleteDespesa(id: number) {
  const res = await api.delete(`/api/despesas/${id}/`);
  return res.data;
}

export async function getDespesaById(id: number) {
  const res = await api.get<Despesa>(`/api/despesas/${id}/`);
  return res.data;
}

