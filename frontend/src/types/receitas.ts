export interface Receita {
  id: number;
  nome: string;
  descricao?: string;
  cliente?: { id: number; nome: string };
  cliente_id?: number;
  valor: number;
  valor_aberto?: number;
  data_vencimento: string;
  tipo: 'F' | 'V' | 'E';
  forma_pagamento?: 'P' | 'B';
  comissionado?: { id: number; nome: string };
  comissionado_id?: number | null;
  situacao: 'A' | 'P' | 'V';
}

export type ReceitaCreate = {
  nome: string;
  descricao?: string;
  cliente_id: number;
  valor: number;
  data_vencimento: string;
  tipo: 'F' | 'V' | 'E';
  forma_pagamento?: 'P' | 'B';
  comissionado_id?: number | null;
};

export type ReceitaUpdate = Partial<ReceitaCreate>;
