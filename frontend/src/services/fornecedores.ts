import { api } from './api';

export interface Fornecedor {
  id: number;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  aniversario: string | null;
  tipo: 'O'; // Sempre Fornecedor
  tipo_display: string;
  salario_mensal: string | null;
}

export async function getFornecedores(): Promise<Fornecedor[]> {
  const res = await api.get<Fornecedor[]>('/api/fornecedores/');
  return res.data;
}

export async function createFornecedor(fornecedor: Omit<Fornecedor, 'id' | 'tipo_display'>) {
  const res = await api.post<Fornecedor>('/api/fornecedores/', fornecedor);
  return res.data;
}

export async function updateFornecedor(id: number, fornecedor: Partial<Fornecedor>) {
  const res = await api.patch<Fornecedor>(`/api/fornecedores/${id}/`, fornecedor);
  return res.data;
}

export async function deleteFornecedor(id: number) {
  const res = await api.delete(`/api/fornecedores/${id}/`);
  return res.data;
}
