import { api } from './api';
import type { Transfer, TransferCreate, TransferUpdate } from '@/types/transfer';

interface TransferListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Transfer[];
}

interface TransferListParams {
  from_bank_id?: number;
  to_bank_id?: number;
  status?: string;
  data_inicio?: string;
  data_fim?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

export const transfersService = {
  /**
   * Lista todas as transferências
   */
  list: async (params?: TransferListParams): Promise<TransferListResponse> => {
    const response = await api.get<TransferListResponse>('/api/transferencias/', { params });
    return response.data;
  },

  /**
   * Obtém uma transferência específica
   */
  get: async (id: number): Promise<Transfer> => {
    const response = await api.get<Transfer>(`/api/transferencias/${id}/`);
    return response.data;
  },

  /**
   * Cria uma nova transferência
   */
  create: async (data: TransferCreate): Promise<Transfer> => {
    const response = await api.post<Transfer>('/api/transferencias/', data);
    return response.data;
  },

  /**
   * Atualiza uma transferência existente
   */
  update: async (id: number, data: TransferUpdate): Promise<Transfer> => {
    const response = await api.patch<Transfer>(`/api/transferencias/${id}/`, data);
    return response.data;
  },

  /**
   * Deleta uma transferência
   */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/api/transferencias/${id}/`);
  },

  /**
   * Lista transferências por banco (origem ou destino)
   */
  listByBank: async (bankId: number): Promise<Transfer[]> => {
    const [fromBank, toBank] = await Promise.all([
      transfersService.list({ from_bank_id: bankId, page_size: 1000 }),
      transfersService.list({ to_bank_id: bankId, page_size: 1000 }),
    ]);

    // Combinar e remover duplicatas
    const allTransfers = [...fromBank.results, ...toBank.results];
    const uniqueTransfers = Array.from(
      new Map(allTransfers.map(t => [t.id, t])).values()
    );

    return uniqueTransfers;
  },
};
