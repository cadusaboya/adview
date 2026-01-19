import { api } from "./api";

/* =========================
   TYPES
========================= */

export interface Receita {
  id: number;
  nome: string;
  cliente_nome: string;
  data_vencimento: string;
  valor: string;
  situacao: "A" | "P" | "V";
  situacao_display: string;
}

/* =========================
   LIST PARAMS (GENÉRICO)
========================= */

export interface ReceitaListParams {
  page?: number;
  page_size?: number;
  search?: string;

  // filtros avançados (DRE / relatórios / listagem)
  situacao?: string | string[];
  start_date?: string; // YYYY-MM-DD
  end_date?: string;   // YYYY-MM-DD
}

/* =========================
   GET GENÉRICO
========================= */

export async function getReceitas(params?: ReceitaListParams) {
  const res = await api.get<{ results: Receita[]; count: number }>(
    "/api/receitas/",
    { params }
  );
  return res.data;
}

/* =========================
   RECEITAS EM ABERTO
========================= */

export async function getReceitasAbertas(params?: ReceitaListParams) {
  const res = await api.get<{ results: Receita[]; count: number }>(
    "/api/receitas/",
    {
      params: {
        ...params,
        situacao: ["A", "V"],
      },
    }
  );
  return res.data;
}

/* =========================
   RECEITAS RECEBIDAS
========================= */

export async function getReceitasRecebidas(params?: ReceitaListParams) {
  const res = await api.get<{ results: Receita[]; count: number }>(
    "/api/receitas/",
    {
      params: {
        ...params,
        situacao: "P",
      },
    }
  );
  return res.data;
}

/* =========================
   CRUD
========================= */

export async function createReceita(data: Partial<Receita>) {
  const res = await api.post("/api/receitas/", data);
  return res.data;
}

export async function updateReceita(id: number, data: Partial<Receita>) {
  const res = await api.patch(`/api/receitas/${id}/`, data);
  return res.data;
}

export async function deleteReceita(id: number) {
  const res = await api.delete(`/api/receitas/${id}/`);
  return res.data;
}

export async function getReceitaById(id: number) {
  const res = await api.get<Receita>(`/api/receitas/${id}/`);
  return res.data;
}
