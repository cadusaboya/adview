// =========================
// NESTED INFO TYPES
// =========================
export interface PaymentInfo {
  id: number;
  valor: number;
  data_pagamento: string;
  conta_bancaria: string;
}

export interface ReceitaInfo {
  id: number;
  nome: string;
  cliente: string;
  valor: number;
}

export interface DespesaInfo {
  id: number;
  nome: string;
  responsavel: string;
  valor: number;
}

export interface CustodiaInfo {
  id: number;
  nome: string;
  tipo: string;
  tipo_display: string;
  pessoa: string;
  valor_total: number;
}

// =========================
// ENTIDADE (RESPOSTA DA API)
// =========================
export interface Allocation {
  id: number;
  company: number;

  // Relações (IDs)
  payment: number;
  receita?: number;
  despesa?: number;
  custodia?: number;

  // Informações aninhadas (read-only)
  payment_info?: PaymentInfo;
  receita_info?: ReceitaInfo;
  despesa_info?: DespesaInfo;
  custodia_info?: CustodiaInfo;

  valor: number;
  observacao?: string;

  criado_em: string;
  atualizado_em: string;
}

// =========================
// PAYLOADS
// =========================

// CREATE
export type AllocationCreate = {
  payment_id: number;
  receita_id?: number;
  despesa_id?: number;
  custodia_id?: number;
  valor: number;
  observacao?: string;
};

// UPDATE
export type AllocationUpdate = Partial<Omit<AllocationCreate, 'payment_id'>>;

// =========================
// LIST PARAMS
// =========================
export interface AllocationListParams {
  page?: number;
  page_size?: number;
  search?: string;

  // Filtros por entidade
  payment_id?: number;
  receita_id?: number;
  despesa_id?: number;
  custodia_id?: number;

  // Filtro por tipo de conta
  tipo_conta?: 'receita' | 'despesa' | 'custodia';
}
