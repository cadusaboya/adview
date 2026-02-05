import { api } from "./api";
import {
  Payment,
  PaymentCreate,
  PaymentUpdate,
  PaymentListParams,
} from "@/types/payments";

type PaginatedResponse<T> = {
  count: number;
  results: T[];
};

/* =========================
   GET PAGAMENTOS
========================= */

export async function getPayments(params?: PaymentListParams) {
  const res = await api.get<PaginatedResponse<Payment>>(
    "/api/pagamentos/",
    { params }
  );

  return res.data;
}

/* =========================
   CRUD
========================= */

export async function createPayment(
  payment: PaymentCreate
): Promise<Payment> {
  const res = await api.post<Payment>(
    "/api/pagamentos/",
    payment
  );
  return res.data;
}

export async function updatePayment(
  id: number,
  payment: PaymentUpdate
): Promise<Payment> {
  const res = await api.put<Payment>(
    `/api/pagamentos/${id}/`,
    payment
  );
  return res.data;
}

export async function deletePayment(id: number): Promise<void> {
  await api.delete(`/api/pagamentos/${id}/`);
}

/* =========================
   IMPORTAR EXTRATO
========================= */

export interface ImportExtratoResponse {
  success: boolean;
  created_count: number;
  conta_bancaria: string;
  saldo_inicial?: string;
  saldo_final?: string;
  total_entradas?: string;
  total_saidas?: string;
  saldo_esperado?: string;
  diferenca?: string;
  errors?: string[];
  total_errors?: number;
}

export async function importExtrato(
  file: File,
  contaBancariaId: number
): Promise<ImportExtratoResponse> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("conta_bancaria_id", String(contaBancariaId));

  const res = await api.post<ImportExtratoResponse>(
    "/api/pagamentos/import-extrato/",
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return res.data;
}

/* =========================
   CONCILIAÇÃO BANCÁRIA
========================= */

export interface SugestaoOpcao {
  tipo: 'receita' | 'despesa' | 'custodia';
  entidade_id: number;
  entidade_nome: string;
  entidade_cliente?: string;
  entidade_responsavel?: string;
  entidade_contraparte?: string;
  entidade_valor: string;
  entidade_vencimento?: string;
  entidade_tipo?: string;
}

export interface SugestaoMatch {
  payment_id: number;
  payment_tipo: string;
  payment_valor: string;
  payment_data: string;
  payment_observacao: string;
  payment_conta: string;
  opcoes: SugestaoOpcao[];
}

export interface ConciliacaoBancariaResponse {
  success: boolean;
  mes: number;
  ano: number;
  total_payments_processados: number;
  matches: {
    receitas: number;
    despesas: number;
    custodias: number;
    total: number;
  };
  sugestoes: SugestaoMatch[];
  total_sugestoes: number;
  debug?: {
    total_receitas_abertas: number;
    total_despesas_abertas: number;
    total_custodias_abertas: number;
    payments_entrada: number;
    payments_saida: number;
  };
  erros: string[];
}

export async function conciliarBancario(
  mes: number,
  ano: number
): Promise<ConciliacaoBancariaResponse> {
  const res = await api.post<ConciliacaoBancariaResponse>(
    "/api/pagamentos/conciliar-bancario/",
    { mes, ano }
  );

  return res.data;
}

export async function confirmarSugestao(
  payment_id: number,
  tipo: 'receita' | 'despesa' | 'custodia',
  entidade_id: number
): Promise<{ success: boolean; message: string }> {
  const res = await api.post(
    "/api/pagamentos/confirmar-sugestao/",
    { payment_id, tipo, entidade_id }
  );

  return res.data;
}
