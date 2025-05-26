import { api } from "./api";

export interface Payment {
  id: number;
  receita?: number; // Opcional se for vinculado a Receita
  despesa?: number;  // Opcional se for vinculado a Despesa
  conta_bancaria: number;
  valor: number;
  data_pagamento: string;
  observacao?: string;
  company: number;
  criado_em: string;
}

// 🔹 Listar pagamentos com paginação
export async function getPayments(params?: { receita?: number; despesa?: number; page?: number; page_size?: number }) {
  const res = await api.get('/api/pagamentos/', { params });
  return res.data; // ⬅️ Retorna objeto com {count, next, previous, results}
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
