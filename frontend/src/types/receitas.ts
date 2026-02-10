import { ComissaoRegra } from './comissoes';

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
  situacao: 'A' | 'P' | 'V';
  comissoes?: ComissaoRegra[];
}

export type ReceitaCreate = {
  nome: string;
  descricao?: string;
  cliente_id: number;
  valor: number;
  data_vencimento: string;
  tipo: 'F' | 'V' | 'E';
  forma_pagamento?: 'P' | 'B';
  comissoes?: { funcionario_id: number; percentual: number }[];
};

export type ReceitaUpdate = Partial<ReceitaCreate>;
