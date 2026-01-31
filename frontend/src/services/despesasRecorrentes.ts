import { api } from './api';
import {
  DespesaRecorrente,
  DespesaRecorrenteCreate,
  DespesaRecorrenteUpdate,
  DespesaRecorrenteListParams,
  GerarMesResponse,
} from '@/types/despesasRecorrentes';

type PaginatedResponse<T> = {
  results: T[];
  count: number;
};

export async function getDespesasRecorrentes(
  params?: DespesaRecorrenteListParams
) {
  const res = await api.get<PaginatedResponse<DespesaRecorrente>>(
    '/api/despesas-recorrentes/',
    { params }
  );
  return res.data;
}

export async function getDespesaRecorrenteById(
  id: number
): Promise<DespesaRecorrente> {
  const res = await api.get<DespesaRecorrente>(
    `/api/despesas-recorrentes/${id}/`
  );
  return res.data;
}

export async function createDespesaRecorrente(
  despesa: DespesaRecorrenteCreate
): Promise<DespesaRecorrente> {
  const res = await api.post<DespesaRecorrente>(
    '/api/despesas-recorrentes/',
    despesa
  );
  return res.data;
}

export async function updateDespesaRecorrente(
  id: number,
  despesa: DespesaRecorrenteUpdate
): Promise<DespesaRecorrente> {
  const res = await api.patch<DespesaRecorrente>(
    `/api/despesas-recorrentes/${id}/`,
    despesa
  );
  return res.data;
}

export async function deleteDespesaRecorrente(id: number): Promise<void> {
  await api.delete(`/api/despesas-recorrentes/${id}/`);
}

export async function gerarDespesasDoMes(
  mes?: string
): Promise<GerarMesResponse> {
  const res = await api.post<GerarMesResponse>(
    '/api/despesas-recorrentes/gerar-mes/',
    mes ? { mes } : {}
  );
  return res.data;
}

export async function gerarProximosMeses(
  id: number,
  quantidadeMeses: number
): Promise<GerarMesResponse> {
  const res = await api.post<GerarMesResponse>(
    `/api/despesas-recorrentes/${id}/gerar-proximos-meses/`,
    { quantidade_meses: quantidadeMeses }
  );
  return res.data;
}
