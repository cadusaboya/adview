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
  
  export async function getReceitas() {
    const res = await api.get<Receita[]>('/api/receitas/');
    return res.data;
  }
  
  export async function createReceita(data: any) {
    const res = await api.post('/api/receitas/', data);
    return res.data;
  }
  
  export async function deleteReceita(id: number) {
    const res = await api.delete(`/api/receitas/${id}/`);
    return res.data;
  }
  