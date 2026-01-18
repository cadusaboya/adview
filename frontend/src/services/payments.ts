import { api } from "./api";

export interface Payment {
  id: number;
  receita?: number;   // Opcional se for Receita
  despesa?: number;   // Opcional se for Despesa
  conta_bancaria: number;
  valor: number;
  data_pagamento: string;
  observacao?: string;
  company: number;
  criado_em: string;

  // 🔹 Campos extras vindos do backend (para tabelas)
  cliente_nome?: string;
  receita_nome?: string;
  favorecido_nome?: string;
  despesa_nome?: string;
}

// 🔹 Listar pagamentos (com paginação + search)
export async function getPayments(params?: {
  receita?: number;
  despesa?: number;
  search?: string;
  page?: number;
  page_size?: number;
}) {
  const res = await api.get<{
    count: number;
    results: Payment[];
  }>('/api/pagamentos/', { params });

  return res.data;
}

// 🔹 Criar pagamento
export async function createPayment(payment: {
  receita?: number;
  despesa?: number;
  conta_bancaria: number;
  valor: number;
  data_pagamento: string;
  observacao?: string;
}) {
  const res = await api.post<Payment>("/api/pagamentos/", payment);
  return res.data;
}

// 🔹 Atualizar pagamento
export async function updatePayment(
  id: number,
  payment: Partial<{
    receita?: number;
    despesa?: number;
    conta_bancaria: number;
    valor: number;
    data_pagamento: string;
    observacao?: string;
  }>
) {
  const res = await api.put<Payment>(`/api/pagamentos/${id}/`, payment);
  return res.data;
}

// 🔹 Deletar pagamento
export async function deletePayment(id: number) {
  await api.delete(`/api/pagamentos/${id}/`);
}
