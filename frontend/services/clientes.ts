import { api } from './api';

export interface Cliente {
  id: number;
  nome: string;
  cpf: string;
  email: string;
  telefone?: string;
  aniversario?: string;
  tipo: string;
}

export async function getClientes() {
  const res = await api.get<Cliente[]>('/api/clientes/');
  return res.data;
}

export async function createCliente(cliente: Omit<Cliente, 'id'>) {
  const res = await api.post<Cliente>('/api/clientes/', cliente);
  return res.data;
}

export async function updateCliente(id: number, cliente: Partial<Cliente>) {
  const res = await api.put<Cliente>(`/api/clientes/${id}/`, cliente);
  return res.data;
}

export async function deleteCliente(id: number) {
  await api.delete(`/api/clientes/${id}/`);
}
