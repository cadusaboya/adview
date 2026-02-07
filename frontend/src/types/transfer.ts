export type TransferStatus = 'P' | 'M' | 'C';

export interface Transfer {
  id: number;
  company: number;
  from_bank: number;
  from_bank_nome: string;
  to_bank: number;
  to_bank_nome: string;
  valor: string;
  data_transferencia: string;
  descricao?: string;
  status: TransferStatus;
  status_display: string;
  valor_saida: string;
  valor_entrada: string;
  criado_em: string;
  atualizado_em: string;
}

export interface TransferCreate {
  from_bank_id: number;
  to_bank_id: number;
  valor: string;
  data_transferencia: string;
  descricao?: string;
}

export interface TransferUpdate {
  from_bank_id?: number;
  to_bank_id?: number;
  valor?: string;
  data_transferencia?: string;
  descricao?: string;
}

export const TRANSFER_STATUS_LABELS: Record<TransferStatus, string> = {
  P: 'Pendente',
  M: 'Mismatch',
  C: 'Completo',
};

export const TRANSFER_STATUS_COLORS: Record<TransferStatus, string> = {
  P: 'bg-yellow-100 text-yellow-800',
  M: 'bg-red-100 text-red-800',
  C: 'bg-green-100 text-green-800',
};
