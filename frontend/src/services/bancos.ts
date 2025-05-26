import { api } from "./api";

export interface Banco {
  id: number;
  nome: string;
  descricao: string;
  saldo_inicial: string;
  saldo_atual: string;
  company: number;
  criado_em: string;
  atualizado_em: string;
}

// 🔹 Listar bancos
export async function getBancos(params?: { page?: number; page_size?: number }) {
  const res = await api.get<{ results: Banco[]; count: number }>('/api/contas-bancarias/', {
    params,
  });
  return res.data;
}

// 🔹 Criar banco
export async function createBanco(banco: Omit<Banco, "id" | "saldo_atual" | "company" | "criado_em" | "atualizado_em">) {
  const res = await api.post<Banco>("/api/contas-bancarias/", banco);
  return res.data;
}

// 🔹 Atualizar banco
export async function updateBanco(id: number, banco: Partial<Omit<Banco, "id" | "saldo_atual" | "company" | "criado_em" | "atualizado_em">>) {
  const res = await api.put<Banco>(`/api/contas-bancarias/${id}/`, banco);
  return res.data;
}

// 🔹 Deletar banco
export async function deleteBanco(id: number) {
  await api.delete(`/api/contas-bancarias/${id}/`);
}
