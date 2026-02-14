export interface PlanoAssinatura {
  id: number;
  nome: string;
  slug: string;
  subtitulo: string;
  descricao: string;
  preco_mensal: string;   // decimal string from DRF, e.g. "120.00"
  preco_anual: string;    // total anual, e.g. "1190.00"
  max_usuarios: number;
  features: string[];
  tem_trial: boolean;
  ativo: boolean;
  ordem: number;
}

export interface AssinaturaStatus {
  id: number;
  plano: PlanoAssinatura | null;
  ciclo: 'MONTHLY' | 'YEARLY';
  status: 'trial' | 'active' | 'overdue' | 'cancelled' | 'expired';
  trial_inicio: string;
  trial_fim: string;
  trial_ativo: boolean;
  dias_trial_restantes: number;
  acesso_permitido: boolean;
  asaas_customer_id: string | null;
  asaas_subscription_id: string | null;
  pending_plano: PlanoAssinatura | null;
  pending_ciclo: 'MONTHLY' | 'YEARLY' | null;
  proxima_cobranca: string | null;
  card_last_four: string | null;
  card_brand: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface PagamentoAsaas {
  id: string;
  value: number;
  dueDate: string;
  paymentDate: string | null;
  status: string;
  invoiceUrl: string;
}

export interface CreditCardData {
  holder_name: string;
  number: string;
  expiry_month: string;
  expiry_year: string;
  ccv: string;
}

export interface CardHolderInfo {
  name: string;
  cpf_cnpj: string;
  email?: string;
  phone?: string;
  postal_code?: string;
  address_number?: string;
}

export interface AssinarPayload {
  plano_slug: string;
  ciclo: 'MONTHLY' | 'YEARLY';
  billing_type?: 'UNDEFINED' | 'CREDIT_CARD';
  credit_card?: CreditCardData;
  holder_info?: CardHolderInfo;
}

export interface AssinarResponse {
  checkout_url?: string;
  asaas_subscription_id: string;
  success?: boolean;
}
