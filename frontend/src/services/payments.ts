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
