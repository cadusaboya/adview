// =========================
// ENTIDADE (RESPOSTA DA API)
// =========================
export interface Payment {
    id: number;
  
    // 🔗 Relações (uma ou outra)
    receita?: number;
    despesa?: number;
  
    conta_bancaria: number;
  
    valor: number;
    data_pagamento: string;
    observacao?: string;
  
    company: number;
    criado_em: string;
  
    // 🔎 Campos extras (JOIN / ANNOTATION)
    cliente_nome?: string;
    receita_nome?: string;
    favorecido_nome?: string;
    despesa_nome?: string;
  }
  
  // =========================
  // PAYLOADS
  // =========================
  
  // CREATE
  export type PaymentCreate = {
    receita?: number;
    despesa?: number;
  
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
  
    receita?: number;
    despesa?: number;
  
    // 🔥 filtro semântico
    tipo?: 'receita' | 'despesa';
  
    start_date?: string; // YYYY-MM-DD
    end_date?: string;   // YYYY-MM-DD
  }
  