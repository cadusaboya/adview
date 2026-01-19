import { api } from "./api";

export interface Payment {
  id: number;
  receita?: number;
  despesa?: number;
  conta_bancaria: number;
  valor: number;
  data_pagamento: string;
  observacao?: string;
  company: number;
  criado_em: string;

  // Campos extras vindos do backend
  cliente_nome?: string;
  receita_nome?: string;
  favorecido_nome?: string;
  despesa_nome?: string;
}

/* =========================
   LIST PARAMS (GENÉRICO)
========================= */

export interface PaymentListParams {
  page?: number;
  page_size?: number;
  search?: string;

  receita?: number;
  despesa?: number;

  // 🔹 NOVOS FILTROS DE PERÍODO
  start_date?: string; // YYYY-MM-DD
  end_date?: string;   // YYYY-MM-DD
}

/* =========================
   GET PAGAMENTOS
========================= */

export async function getPayments(params?: PaymentListParams) {
  const res = await api.get<{
    count: number;
    results: Payment[];
  }>("/api/pagamentos/", {
    params,
  });

  return res.data;
}

/* =========================
   CRUD
========================= */

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

export async function deletePayment(id: number) {
  await api.delete(`/api/pagamentos/${id}/`);
}
