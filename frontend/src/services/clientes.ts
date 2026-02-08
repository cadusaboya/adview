import { api } from './api';
import {
  Cliente,
  ClienteCreate,
  ClienteUpdate,
} from '@/types/clientes';

type PaginatedResponse<T> = {
  results: T[];
  count: number;
};

// 🔹 LISTAGEM
export async function getClientes(params?: {
  page?: number;
  page_size?: number;
  search?: string;
}) {
  const res = await api.get<PaginatedResponse<Cliente>>(
    '/api/clientes/',
    { params }
  );
  return res.data;
}

// 🔹 CREATE → payload fechado
export async function createCliente(
  cliente: ClienteCreate
): Promise<Cliente> {
  const res = await api.post<Cliente>(
    '/api/clientes/',
    cliente
  );
  return res.data;
}

// 🔹 UPDATE → payload parcial
export async function updateCliente(
  id: number,
  cliente: ClienteUpdate
): Promise<Cliente> {
  const res = await api.patch<Cliente>(
    `/api/clientes/${id}/`,
    cliente
  );
  return res.data;
}

// 🔹 DELETE
export async function deleteCliente(
  id: number
): Promise<void> {
  await api.delete(`/api/clientes/${id}/`);
}

// 🔹 GERAR COMISSÕES
export async function gerarComissoes(mes: number, ano: number): Promise<{
  comissionados: Array<{ id: number; nome: string; valor: number }>;
  total: number;
  mes: number;
  ano: number;
}> {
  const res = await api.post('/api/clientes/gerar-comissoes/', { mes, ano });
  return res.data;
}
