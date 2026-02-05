export interface Custodia {
  id: number;
  nome: string;
  descricao?: string;
  tipo: 'P' | 'A'; // P = Passivo, A = Ativo
  tipo_display: string;
  cliente?: { id: number; nome: string };
  funcionario?: { id: number; nome: string };
  cliente_id?: number | null;
  funcionario_id?: number | null;
  valor_total: number;
  valor_liquidado: number;
  status: 'A' | 'P' | 'L';
  status_display: string;
  criado_em: string;
  atualizado_em: string;
}

export type CustodiaCreate = {
  nome: string;
  descricao?: string;
  tipo: 'P' | 'A'; // P = Passivo, A = Ativo
  cliente_id?: number | null;
  funcionario_id?: number | null;
  valor_total: number;
};

export type CustodiaUpdate = Partial<CustodiaCreate>;
