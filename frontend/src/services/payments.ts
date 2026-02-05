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
