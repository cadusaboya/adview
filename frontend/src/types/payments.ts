// =========================
// ALLOCATION INFO (nested in Payment)
// =========================
export interface AllocationInfo {
  id: number;
  valor: number;
  receita?: {
    id: number;
    nome: string;
    cliente: string;
  };
  despesa?: {
    id: number;
    nome: string;
    responsavel: string;
  };
  custodia?: {
    id: number;
    nome: string;
    tipo: string;
    tipo_display: string;
  };
}

// =========================
// ENTIDADE (RESPOSTA DA API)
// =========================
export interface Payment {
  id: number;

  // 🔹 Novo: Tipo de movimentação
  tipo: 'E' | 'S'; // Entrada ou Saída
  tipo_display?: string; // "Entrada" ou "Saída"

  conta_bancaria: number;
  conta_bancaria_nome?: string;

  valor: number;
  data_pagamento: string;
  observacao?: string;

  company: number;
  criado_em: string;

  // 🔗 Informações das alocações vinculadas
  allocations_info?: AllocationInfo[];
}

// =========================
// PAYLOADS
// =========================

// CREATE
export type PaymentCreate = {
  tipo: 'E' | 'S'; // Entrada ou Saída
  conta_bancaria: number;
  valor: number;
  data_pagamento: string;
  observacao?: string;
};

// UPDATE
export type PaymentUpdate = Partial<PaymentCreate>;

// =========================
// LIST PARAMS
// =========================
export interface PaymentListParams {
  page?: number;
  page_size?: number;
  search?: string;

  // 🔥 Filtro por tipo (Entrada/Saída)
  tipo?: 'E' | 'S';

  // 🔹 Filtro por conta bancária
  conta_bancaria_id?: number;

  // 🔹 Filtro por situação da receita/despesa
  situacao?: 'P' | 'A' | 'V'; // Paga, Em Aberto, Vencida

  start_date?: string; // YYYY-MM-DD
  end_date?: string;   // YYYY-MM-DD
}
