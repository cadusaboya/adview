export interface ReceitaRecorrente {
  id: number;
  nome: string;
  descricao: string;

  cliente_id: number;
  cliente: {
    id: number;
    nome: string;
  };

  valor: number;
  tipo: 'F' | 'V';
  tipo_display: string;

  forma_pagamento: 'P' | 'B' | null; // P = Pix, B = Boleto
  forma_pagamento_display: string | null;

  data_inicio: string;
  data_fim: string | null;
  dia_vencimento: number;

  status: 'A' | 'P';
  status_display: string;

  created_at: string;
  updated_at: string;
}

export type ReceitaRecorrenteCreate = {
  nome: string;
  descricao: string;
  cliente_id: number;
  valor: number;
  tipo: 'F' | 'V';
  forma_pagamento?: 'P' | 'B' | null;
  data_inicio: string;
  data_fim?: string | null;
  dia_vencimento: number;
  status?: 'A' | 'P';
};

export type ReceitaRecorrenteUpdate = Partial<ReceitaRecorrenteCreate>;

export interface ReceitaRecorrenteListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: 'A' | 'P';
  tipo?: 'F' | 'V';
  cliente_id?: number;
}

export interface GerarMesResponse {
  criadas: number;
  ignoradas: number;
  mes: string;
  detalhes: Array<{
    nome: string;
    status: 'criada' | 'ignorada' | 'erro';
    data_vencimento?: string;
    motivo?: string;
  }>;
}
