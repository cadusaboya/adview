import { api } from './api';
import { Passivo, PassivoCreate, PassivoUpdate } from '@/types/passivos';

/* =========================
   LIST PARAMS
========================= */

export interface PassivoListParams {
  page?: number;
  page_size?: number;
  search?: string;
  status?: string | string[];
}

/* =========================
   GET GENÉRICO
========================= */

export async function getPassivos(params?: PassivoListParams) {
  const res = await api.get<{ results: Passivo[]; count: number }>(
    '/api/passivos/',
    { params }
  );
  return res.data;
}

/* =========================
   PASSIVOS EM ABERTO
========================= */

export async function getPassivosAbertos(params?: PassivoListParams) {
  const res = await api.get<{ results: Passivo[]; count: number }>(
    '/api/passivos/',
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
   PASSIVOS LIQUIDADOS
========================= */

export async function getPassivosLiquidados(params?: PassivoListParams) {
  const res = await api.get<{ results: Passivo[]; count: number }>(
    '/api/passivos/',
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

export async function createPassivo(data: PassivoCreate) {
  const res = await api.post<Passivo>('/api/passivos/', data);
  return res.data;
}

export async function updatePassivo(
  id: number,
  data: PassivoUpdate
) {
  const res = await api.patch<Passivo>(
    `/api/passivos/${id}/`,
    data
  );
  return res.data;
}

export async function deletePassivo(id: number) {
  await api.delete(`/api/passivos/${id}/`);
}

/* =========================
   GET BY ID
========================= */

export async function getPassivoById(id: number) {
  const res = await api.get<Passivo>(`/api/passivos/${id}/`);
  return res.data;
}
