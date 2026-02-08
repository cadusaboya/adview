import { api } from './api';
import { Custodia, CustodiaCreate, CustodiaUpdate } from '@/types/custodias';

/* =========================
   LIST PARAMS
========================= */

export interface CustodiaListParams {
  page?: number;
  page_size?: number;
  search?: string;
  tipo?: 'P' | 'A'; // P = Passivo, A = Ativo
  status?: string | string[];
}

/* =========================
   GET GENÉRICO
========================= */

export async function getCustodias(params?: CustodiaListParams) {
  const res = await api.get<{ results: Custodia[]; count: number }>(
    '/api/custodias/',
    { params }
  );
  return res.data;
}

/* =========================
   CUSTÓDIAS EM ABERTO
========================= */

export async function getCustodiasAbertas(params?: CustodiaListParams) {
  const res = await api.get<{ results: Custodia[]; count: number }>(
    '/api/custodias/',
    {
      params: {
        ...params,
        status: ['A', 'P'],
      },
    }
  );
  return res.data;
}

/* =========================
   CUSTÓDIAS LIQUIDADAS
========================= */

export async function getCustodiasLiquidadas(params?: CustodiaListParams) {
  const res = await api.get<{ results: Custodia[]; count: number }>(
    '/api/custodias/',
    {
      params: {
        ...params,
        status: 'L',
      },
    }
  );
  return res.data;
}

/* =========================
   CRUD
========================= */

export async function createCustodia(data: CustodiaCreate) {
  const res = await api.post<Custodia>('/api/custodias/', data);
  return res.data;
}

export async function updateCustodia(
  id: number,
  data: CustodiaUpdate
) {
  const res = await api.patch<Custodia>(
    `/api/custodias/${id}/`,
    data
  );
  return res.data;
}

export async function deleteCustodia(id: number) {
  await api.delete(`/api/custodias/${id}/`);
}

/* =========================
   GET BY ID
========================= */

export async function getCustodiaById(id: number) {
  const res = await api.get<Custodia>(`/api/custodias/${id}/`);
  return res.data;
}
