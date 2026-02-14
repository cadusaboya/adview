import { api } from './api';
import type {
  PlanoAssinatura,
  AssinaturaStatus,
  AssinarPayload,
  AssinarResponse,
  PagamentoAsaas,
  CreditCardData,
  CardHolderInfo,
} from '@/types/assinatura';

export async function getPlanos(): Promise<PlanoAssinatura[]> {
  const res = await api.get<PlanoAssinatura[] | { results: PlanoAssinatura[] }>('/api/planos/');
  return Array.isArray(res.data) ? res.data : res.data.results;
}

export async function getAssinaturaStatus(): Promise<AssinaturaStatus> {
  const res = await api.get<AssinaturaStatus>('/api/assinatura/status_assinatura/');
  return res.data;
}

export async function assinar(payload: AssinarPayload): Promise<AssinarResponse> {
  const res = await api.post<AssinarResponse>('/api/assinatura/assinar/', payload);
  return res.data;
}

export async function cancelarAssinatura(): Promise<void> {
  await api.post('/api/assinatura/cancelar/');
}

export async function reativarAssinatura(): Promise<AssinaturaStatus> {
  const res = await api.post<AssinaturaStatus>('/api/assinatura/reativar/');
  return res.data;
}

export async function getLinkPagamento(): Promise<string> {
  const res = await api.get<{ payment_url: string }>('/api/assinatura/link_pagamento/');
  return res.data.payment_url;
}

export async function getHistoricoPagamentos(): Promise<PagamentoAsaas[]> {
  const res = await api.get<PagamentoAsaas[]>('/api/assinatura/pagamentos/');
  return res.data;
}

export async function atualizarCartao(
  credit_card: CreditCardData,
  holder_info: CardHolderInfo,
): Promise<void> {
  await api.post('/api/assinatura/atualizar_cartao/', { credit_card, holder_info });
}
