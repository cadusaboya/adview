import { api } from './api';

export interface Funcionario {
  id: number;
  nome: string;
  cpf: string;
  email: string;
  telefone: string;
  aniversario: string | null;
  tipo: 'F' | 'P' | 'C'; // Funcionário, Parceiro, Colaborador
  tipo_display: string;
  salario_mensal: string | null;
}

export async function getFuncionarios(params?: { page?: number; page_size?: number }) {
  const res = await api.get<{ results: Funcionario[]; count: number }>('/api/funcionarios/', {
    params,
  });
  return res.data;
}

export async function createFuncionario(funcionario: Omit<Funcionario, 'id' | 'tipo_display'>) {
  const res = await api.post<Funcionario>('/api/funcionarios/', funcionario);
  return res.data;
}

export async function updateFuncionario(id: number, funcionario: Partial<Funcionario>) {
  const res = await api.patch<Funcionario>(`/api/funcionarios/${id}/`, funcionario);
  return res.data;
}

export async function deleteFuncionario(id: number) {
  const res = await api.delete(`/api/funcionarios/${id}/`);
  return res.data;
}
