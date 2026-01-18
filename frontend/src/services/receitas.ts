import { api } from './api';

export interface Receita {
    id: number;
    nome: string;
    cliente_nome: string;
    data_vencimento: string;
    valor: string;
    situacao: string;
    situacao_display: string;
  }
  
  export async function getReceitas(params?: { page?: number; page_size?: number }) {
    const res = await api.get<{ results: Receita[]; count: number }>('/api/receitas/', {
      params,
    });
    return res.data;
  }
  
  export async function getReceitasAbertas(params?: {
    page?: number;
    page_size?: number;
    search?: string;
  }) {
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
  
  
  export async function getReceitasRecebidas(params?: { page?: number; page_size?: number }) {
    const res = await api.get<{ results: Receita[]; count: number }>('/api/receitas/', {
      params: { ...params, situacao: 'P' },
    });
    return res.data;
  }
  

  export async function createReceita(data: any) {
    const res = await api.post('/api/receitas/', data);
    return res.data;
  }

  export async function updateReceita(id: number, data: any) {
    const res = await api.patch(`/api/receitas/${id}/`, data);
    return res.data;
  }
  
  export async function deleteReceita(id: number) {
    const res = await api.delete(`/api/receitas/${id}/`);
    return res.data;
  }

  export async function getReceitaById(id: number) {
    const res = await api.get<Receita>(`/api/receitas/${id}/`);
    return res.data;
  }
  