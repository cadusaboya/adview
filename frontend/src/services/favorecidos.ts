import { api } from './api';

export interface Favorecido {
  id: number;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  aniversario: string | null;
  tipo: 'F' | 'P' | 'O'; // Funcionário, Parceiro, Colaborador
  tipo_display: string;
  salario_mensal: string | null;
}

export async function getFavorecidos(params?: {
    page?: number;
    page_size?: number;
  }) {
    const res = await api.get('/api/favorecidos/', { params });
    return res.data;
  }
  