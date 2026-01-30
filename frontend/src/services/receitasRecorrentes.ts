import { api } from './api';
import {
  ReceitaRecorrente,
  ReceitaRecorrenteCreate,
  ReceitaRecorrenteUpdate,
  ReceitaRecorrenteListParams,
  GerarMesResponse,
} from '@/types/receitasRecorrentes';

type PaginatedResponse<T> = {
  results: T[];
  count: number;
};

export async function getReceitasRecorrentes(
  params?: ReceitaRecorrenteListParams
) {
  const res = await api.get<PaginatedResponse<ReceitaRecorrente>>(
    '/api/receitas-recorrentes/',
    { params }
  );
  return res.data;
}

export async function getReceitaRecorrenteById(
  id: number
): Promise<ReceitaRecorrente> {
  const res = await api.get<ReceitaRecorrente>(
    `/api/receitas-recorrentes/${id}/`
  );
  return res.data;
}

export async function createReceitaRecorrente(
  receita: ReceitaRecorrenteCreate
): Promise<ReceitaRecorrente> {
  const res = await api.post<ReceitaRecorrente>(
    '/api/receitas-recorrentes/',
    receita
  );
  return res.data;
}

export async function updateReceitaRecorrente(
  id: number,
  receita: ReceitaRecorrenteUpdate
): Promise<ReceitaRecorrente> {
  const res = await api.patch<ReceitaRecorrente>(
    `/api/receitas-recorrentes/${id}/`,
    receita
  );
  return res.data;
}

export async function deleteReceitaRecorrente(id: number): Promise<void> {
  await api.delete(`/api/receitas-recorrentes/${id}/`);
}

export async function gerarReceitasDoMes(
  mes?: string
): Promise<GerarMesResponse> {
  const res = await api.post<GerarMesResponse>(
    '/api/receitas-recorrentes/gerar-mes/',
    mes ? { mes } : {}
  );
  return res.data;
}
