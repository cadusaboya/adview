// types/despesas.ts

// 🔹 Entidade vinda da API
export interface Despesa {
    id: number;
    nome: string;
    descricao: string;
  
    responsavel_id: number;
    responsavel: {
      id: number;
      nome: string;
    };
  
    data_vencimento: string;
    data_pagamento: string | null;
  
    valor: number;
    valor_aberto?: number;
    valor_pago: number | null;
  
    tipo: 'F' | 'V' | 'C' | 'R';
    situacao: 'A' | 'P' | 'V';
  
    tipo_display: string;
    situacao_display: string;
  }
  
  // 🔹 Payload de criação
  export type DespesaCreate = {
    nome: string;
    descricao: string;
  
    responsavel_id: number;
  
    data_vencimento: string;
    data_pagamento?: string | null;
  
    valor: number;
  
    tipo: 'F' | 'V' | 'C' | 'R';
    situacao?: 'A' | 'P' | 'V';
  };
  
  // 🔹 Payload de atualização
  export type DespesaUpdate = Partial<DespesaCreate>;
  
  // 🔹 Params de listagem
  export interface DespesaListParams {
    page?: number;
    page_size?: number;
    search?: string;
    situacao?: 'A' | 'P' | 'V' | Array<'A' | 'P' | 'V'>;
    tipo?: 'F' | 'V' | 'C' | 'R';
    start_date?: string;
    end_date?: string;
    responsavel_id?: number;
  }
  