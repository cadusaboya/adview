'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  IconCrown,
  IconStar,
  IconRocket,
  IconAlertCircle,
  IconCircleCheck,
  IconClock,
  IconX,
  IconArrowRight,
  IconShield,
  IconExternalLink,
  IconCalendar,
  IconReceipt,
  IconCreditCard,
} from '@tabler/icons-react';
import { NavbarNested } from '@/components/imports/Navbar/NavbarNested';
import DialogBase from '@/components/dialogs/DialogBase';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { cancelarAssinatura, getLinkPagamento, getHistoricoPagamentos, reativarAssinatura, atualizarCartao } from '@/services/assinatura';
import { getMyEmpresa } from '@/services/empresa';
import type { PagamentoAsaas, CreditCardData, CardHolderInfo } from '@/types/assinatura';
import { formatDateBR, formatCurrencyBR } from '@/lib/formatters';

const PLAN_ICONS: Record<string, React.ReactNode> = {
  essencial: <IconStar size={20} />,
  profissional: <IconCrown size={20} />,
  evolution: <IconRocket size={20} />,
};

const STATUS_CONFIG = {
  trial: {
    label: 'Período de Teste',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    text: 'text-amber-700',
    badge: 'bg-amber-100 text-amber-700 border border-amber-200',
    icon: IconClock,
    iconColor: 'text-amber-500',
  },
  active: {
    label: 'Ativa',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    text: 'text-emerald-700',
    badge: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    icon: IconCircleCheck,
    iconColor: 'text-emerald-500',
  },
  overdue: {
    label: 'Pagamento Pendente',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700 border border-red-200',
    icon: IconAlertCircle,
    iconColor: 'text-red-500',
  },
  payment_failed: {
    label: 'Pagamento Recusado',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700 border border-red-200',
    icon: IconAlertCircle,
    iconColor: 'text-red-500',
  },
  cancelled: {
    label: 'Cancelada',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    text: 'text-gray-600',
    badge: 'bg-gray-100 text-gray-600 border border-gray-200',
    icon: IconX,
    iconColor: 'text-gray-400',
  },
  expired: {
    label: 'Expirada',
    bg: 'bg-red-50',
    border: 'border-red-200',
    text: 'text-red-700',
    badge: 'bg-red-100 text-red-700 border border-red-200',
    icon: IconAlertCircle,
    iconColor: 'text-red-500',
  },
};

const EMPTY_CARD: CreditCardData = { holder_name: '', number: '', expiry_month: '', expiry_year: '', ccv: '' };
const EMPTY_HOLDER: CardHolderInfo = { name: '', cpf_cnpj: '', email: '', phone: '', postal_code: '', address_number: '' };

function fmtCardNumber(v: string) { return v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim(); }
function fmtExpiry(v: string) { const d = v.replace(/\D/g, '').slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; }
function fmtPhone(v: string) { const d = v.replace(/\D/g, '').slice(0, 11); return d.length <= 10 ? d.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '') : d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, ''); }
function fmtCep(v: string) { const d = v.replace(/\D/g, '').slice(0, 8); return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d; }
function fmtCpfCnpj(v: string) { const d = v.replace(/\D/g, '').slice(0, 14); if (d.length <= 11) return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2'); return d.replace(/(\d{2})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1/$2').replace(/(\d{4})(\d{1,2})$/, '$1-$2'); }

export default function AssinaturaPage() {
  const [cancelling, setCancelling] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [loadingPaymentUrl, setLoadingPaymentUrl] = useState(false);
  const [loadingPendingUrl, setLoadingPendingUrl] = useState(false);
  const [historico, setHistorico] = useState<PagamentoAsaas[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [nomeEmpresa, setNomeEmpresa] = useState('');
  const [showCardDialog, setShowCardDialog] = useState(false);
  const [card, setCard] = useState<CreditCardData>(EMPTY_CARD);
  const [holder, setHolder] = useState<CardHolderInfo>(EMPTY_HOLDER);
  const [updatingCard, setUpdatingCard] = useState(false);
  const { assinatura, loading, refresh } = useSubscription();
  const router = useRouter();

  useEffect(() => {
    getMyEmpresa().then((e) => setNomeEmpresa(e.name)).catch(() => {});
  }, []);


  const handleContinuarPagamento = async () => {
    setLoadingPendingUrl(true);
    try {
      const url = await getLinkPagamento();
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      toast.error('Não foi possível obter o link de pagamento.');
    } finally {
      setLoadingPendingUrl(false);
    }
  };

  // Fetch payment URL when overdue or payment_failed
  useEffect(() => {
    if (assinatura?.status === 'overdue' || assinatura?.status === 'payment_failed') {
      setLoadingPaymentUrl(true);
      getLinkPagamento()
        .then(setPaymentUrl)
        .catch(() => setPaymentUrl(null))
        .finally(() => setLoadingPaymentUrl(false));
    }
  }, [assinatura?.status]);

  // Fetch payment history for active subscriptions
  useEffect(() => {
    if (assinatura?.asaas_subscription_id) {
      setLoadingHistorico(true);
      getHistoricoPagamentos()
        .then(setHistorico)
        .catch(() => setHistorico([]))
        .finally(() => setLoadingHistorico(false));
    }
  }, [assinatura?.asaas_subscription_id]);

  const handleCancelar = async () => {
    setCancelling(true);
    try {
      await cancelarAssinatura();
      toast.success('Assinatura cancelada com sucesso.');
      setShowCancelConfirm(false);
      refresh();
    } catch {
      toast.error('Erro ao cancelar assinatura. Tente novamente.');
    } finally {
      setCancelling(false);
    }
  };

  const handleReativar = async () => {
    setReactivating(true);
    try {
      await reativarAssinatura();
      toast.success('Assinatura reativada com sucesso!');
      refresh();
    } catch {
      toast.error('Erro ao reativar assinatura. Tente novamente.');
    } finally {
      setReactivating(false);
    }
  };

  const handleAtualizarCartao = async () => {
    if (
      !card.holder_name.trim() ||
      card.number.replace(/\s/g, '').length < 16 ||
      !card.expiry_month || !card.expiry_year ||
      card.ccv.length < 3 ||
      !holder.name.trim() ||
      holder.cpf_cnpj.replace(/\D/g, '').length < 11 ||
      !holder.email?.trim() ||
      (holder.phone?.replace(/\D/g, '') ?? '').length < 10 ||
      !holder.postal_code?.trim()
    ) {
      toast.error('Preencha todos os campos obrigatórios.');
      return;
    }
    setUpdatingCard(true);
    try {
      await atualizarCartao({ ...card, number: card.number.replace(/\s/g, '') }, holder);
      await refresh();
      toast.success('Cartão atualizado com sucesso!');
      setShowCardDialog(false);
      setCard(EMPTY_CARD);
      setHolder(EMPTY_HOLDER);
    } catch {
      toast.error('Erro ao atualizar cartão. Verifique os dados e tente novamente.');
    } finally {
      setUpdatingCard(false);
    }
  };

  if (loading) {
    return (
      <div className="flex">
        <NavbarNested />
        <main className="main-content-with-navbar bg-muted min-h-screen w-full p-6">
          <div className="flex justify-center items-center h-64">
            <p className="text-gray-500">Carregando...</p>
          </div>
        </main>
      </div>
    );
  }

  if (!assinatura) {
    return (
      <div className="flex">
        <NavbarNested />
        <main className="main-content-with-navbar bg-muted min-h-screen w-full p-6">
          <div className="flex justify-center items-center h-64">
            <p className="text-gray-500">Nenhuma assinatura encontrada.</p>
          </div>
        </main>
      </div>
    );
  }

  const status = STATUS_CONFIG[assinatura.status] ?? STATUS_CONFIG.expired;
  const StatusIcon = status.icon;
  const planIcon = assinatura.plano ? PLAN_ICONS[assinatura.plano.slug] : <IconStar size={20} />;

  const isActive = assinatura.status === 'active';
  const isTrial = assinatura.status === 'trial';
  const isOverdue = assinatura.status === 'overdue';
  const isPaymentFailed = assinatura.status === 'payment_failed';
  const isCancelledWithAccess = assinatura.status === 'cancelled' && assinatura.acesso_permitido;
  const isCancelledNoAccess = (assinatura.status === 'cancelled' && !assinatura.acesso_permitido) || assinatura.status === 'expired';

  const canCancel = isActive || isOverdue;
  const needsAction = isTrial || isOverdue || isPaymentFailed || isCancelledNoAccess;

  const cicloLabel = assinatura.ciclo === 'YEARLY' ? 'Anual' : 'Mensal';
  const precoMes = assinatura.plano
    ? assinatura.ciclo === 'YEARLY'
      ? parseFloat(assinatura.plano.preco_anual) / 12
      : parseFloat(assinatura.plano.preco_mensal)
    : null;

  return (
    <div className="flex">
      <NavbarNested />

      <main className="main-content-with-navbar bg-muted min-h-screen w-full p-6">
        <div className="max-w-3xl mx-auto">

          {/* Header */}
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-serif font-bold text-navy">Assinatura</h1>
          </div>

          {/* Pending payment warning */}
          {assinatura.pending_plano && (
            <div className="rounded-lg border border-red-300 bg-red-50 p-4 mb-4 flex items-start gap-3">
              <IconAlertCircle size={20} className="mt-0.5 flex-shrink-0 text-red-500" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-700">
                  Você tem um pagamento em aberto
                </p>
                <p className="text-xs text-red-600 mt-0.5 opacity-80">
                  Termine o pagamento da assinatura <strong>{assinatura.pending_plano.nome}</strong> para ativar ou renovar seu plano.
                </p>
              </div>
              <button
                onClick={handleContinuarPagamento}
                disabled={loadingPendingUrl}
                className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-red-600 text-white hover:bg-red-700 transition disabled:opacity-50"
              >
                {loadingPendingUrl ? 'Buscando...' : 'Continuar'}
                {!loadingPendingUrl && <IconArrowRight size={13} />}
              </button>
            </div>
          )}

          {/* Warning banner for cancelled-but-still-active */}
          {isCancelledWithAccess && assinatura.proxima_cobranca && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 mb-4 flex items-start gap-3">
              <IconAlertCircle size={20} className="mt-0.5 flex-shrink-0 text-amber-500" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-700">
                  Assinatura cancelada — acesso até {formatDateBR(assinatura.proxima_cobranca)}
                </p>
                <p className="text-xs text-amber-600 mt-0.5 opacity-90">
                  Você ainda tem acesso até o fim do período já pago. Reative para continuar sem interrupção.
                </p>
              </div>
              <button
                onClick={handleReativar}
                disabled={reactivating}
                className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#0A192F] text-white hover:bg-[#0A192F]/90 transition disabled:opacity-50"
              >
                {reactivating ? 'Reativando...' : 'Reativar'}
                {!reactivating && <IconArrowRight size={13} />}
              </button>
            </div>
          )}

          {/* Alert banner for overdue / trial / cancelled */}
          {needsAction && (
            <div className={`rounded-lg border p-4 mb-4 ${status.bg} ${status.border}`}>
              <div className="flex items-start gap-3">
                <StatusIcon size={20} className={`mt-0.5 flex-shrink-0 ${status.iconColor}`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold ${status.text}`}>
                    {isTrial && assinatura.trial_ativo && assinatura.dias_trial_restantes > 0
                      ? `${assinatura.dias_trial_restantes} ${assinatura.dias_trial_restantes === 1 ? 'dia restante' : 'dias restantes'} no período de teste`
                      : isTrial && assinatura.trial_ativo
                      ? 'Seu período de teste expira hoje'
                      : isTrial
                      ? 'Seu período de teste encerrou'
                      : isOverdue
                      ? 'Há um pagamento pendente na sua assinatura'
                      : isPaymentFailed
                      ? 'Seu pagamento foi recusado'
                      : 'Sua assinatura está inativa'}
                  </p>
                  <p className={`text-xs mt-0.5 ${status.text} opacity-80`}>
                    {isTrial
                      ? 'Assine um plano para continuar utilizando o Vincor após o término do teste.'
                      : isOverdue
                      ? 'Regularize seu pagamento para manter o acesso sem interrupções.'
                      : isPaymentFailed
                      ? 'O cartão foi recusado. Pague a cobrança pendente abaixo para reativar seu acesso.'
                      : 'Escolha um plano para reativar o acesso ao sistema.'}
                  </p>

                  {/* Payment link for overdue or payment_failed */}
                  {(isOverdue || isPaymentFailed) && (
                    <div className="mt-3">
                      {loadingPaymentUrl ? (
                        <p className="text-xs text-red-500 opacity-70">Buscando link de pagamento...</p>
                      ) : paymentUrl ? (
                        <a
                          href={paymentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition px-3 py-1.5 rounded-full"
                        >
                          <IconExternalLink size={13} />
                          Pagar agora
                        </a>
                      ) : (
                        <p className="text-xs text-red-500 opacity-70">
                          Link de pagamento não disponível. Entre em contato com o suporte.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {!isOverdue && !isPaymentFailed && (
                  <button
                    onClick={() => router.push('/assinar')}
                    className="flex-shrink-0 flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-[#0A192F] text-white hover:bg-[#0A192F]/90 transition"
                  >
                    {isTrial ? 'Assinar agora' : 'Reativar'}
                    <IconArrowRight size={13} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Main card */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-4">

            {/* Plan header */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-[#0A192F]/8 flex items-center justify-center text-[#0A192F]">
                  {planIcon}
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Plano atual</p>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-serif font-bold text-navy">
                      {assinatura.plano?.nome ?? 'Período de Teste'}
                    </h2>
                    {isTrial && (
                      <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                        Teste
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <span className={`text-xs font-semibold px-3 py-1 rounded-full ${status.badge}`}>
                {status.label}
              </span>
            </div>

            {/* Details grid */}
            <div className="divide-y divide-gray-50">

              {/* Price + cycle */}
              {assinatura.plano && precoMes !== null && (
                <div className="px-6 py-4 flex items-center justify-between">
                  <span className="text-sm text-gray-500">Cobrança</span>
                  <div className="text-right">
                    <span className="text-sm font-semibold text-navy">
                      {formatCurrencyBR(precoMes)}/mês
                    </span>
                    <span className="ml-2 text-xs text-gray-400">({cicloLabel})</span>
                    {assinatura.ciclo === 'YEARLY' && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {formatCurrencyBR(parseFloat(assinatura.plano.preco_anual))} cobrado anualmente
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Max users */}
              {assinatura.plano && (
                <div className="px-6 py-4 flex items-center justify-between">
                  <span className="text-sm text-gray-500">Usuários incluídos</span>
                  <span className="text-sm font-semibold text-navy">
                    {assinatura.plano.max_usuarios === 0 ? 'Ilimitados' : assinatura.plano.max_usuarios}
                  </span>
                </div>
              )}

              {/* Trial dates */}
              {isTrial && (
                <>
                  <div className="px-6 py-4 flex items-center justify-between">
                    <span className="text-sm text-gray-500">Início do teste</span>
                    <span className="text-sm font-medium text-navy">
                      {formatDateBR(assinatura.trial_inicio?.split('T')[0])}
                    </span>
                  </div>
                  <div className="px-6 py-4 flex items-center justify-between">
                    <span className="text-sm text-gray-500">Fim do teste</span>
                    <span className="text-sm font-medium text-navy">
                      {formatDateBR(assinatura.trial_fim?.split('T')[0])}
                    </span>
                  </div>
                </>
              )}

              {/* Next billing date */}
              {isActive && assinatura.proxima_cobranca && (
                <div className="px-6 py-4 flex items-center justify-between">
                  <span className="text-sm text-gray-500">Próxima cobrança</span>
                  <div className="flex items-center gap-1.5">
                    <IconCalendar size={14} className="text-gray-400" />
                    <span className="text-sm font-semibold text-navy">
                      {formatDateBR(assinatura.proxima_cobranca)}
                    </span>
                  </div>
                </div>
              )}

              {/* Member since */}
              <div className="px-6 py-4 flex items-center justify-between">
                <span className="text-sm text-gray-500">Cliente desde</span>
                <span className="text-sm font-medium text-navy">
                  {formatDateBR(assinatura.criado_em?.split('T')[0])}
                </span>
              </div>

            </div>
          </div>


          {/* Actions */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-sm font-semibold text-navy mb-4">Ações</h3>
            <div className="flex flex-col gap-3">

              {/* Reativar sem novo pagamento (cancelada mas ainda com acesso) */}
              {isCancelledWithAccess && (
                <button
                  onClick={handleReativar}
                  disabled={reactivating}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-[#0A192F] text-white text-sm font-semibold hover:bg-[#0A192F]/90 transition disabled:opacity-50"
                >
                  <span>{reactivating ? 'Reativando...' : 'Reativar assinatura'}</span>
                  {!reactivating && <IconArrowRight size={16} />}
                </button>
              )}

              {/* Assinar / reativar (sem acesso) */}
              {(isTrial || isCancelledNoAccess) && (
                <button
                  onClick={() => router.push('/assinar')}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-[#0A192F] text-white text-sm font-semibold hover:bg-[#0A192F]/90 transition"
                >
                  <span>{isTrial ? 'Escolher um plano' : 'Reativar assinatura'}</span>
                  <IconArrowRight size={16} />
                </button>
              )}

              {/* Overdue: pay link or redirect */}
              {isOverdue && (
                paymentUrl ? (
                  <a
                    href={paymentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
                  >
                    <span>Pagar fatura pendente</span>
                    <IconExternalLink size={16} />
                  </a>
                ) : (
                  <button
                    onClick={() => router.push('/assinar')}
                    className="flex items-center justify-between w-full px-4 py-3 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition"
                  >
                    <span>Regularizar pagamento pendente</span>
                    <IconArrowRight size={16} />
                  </button>
                )
              )}

              {isActive && (
                <a
                  href={`https://wa.me/5591984147769?text=${encodeURIComponent(`Olá, sou usuário da empresa ${nomeEmpresa || '?'} e gostaria de alterar de plano.`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between w-full px-4 py-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  <span>Alterar plano</span>
                  <IconArrowRight size={16} />
                </a>
              )}

              {/* Alterar cartão */}
              {canCancel && assinatura.asaas_subscription_id && (
                <button
                  onClick={() => setShowCardDialog(true)}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  <span className="flex items-center gap-2">
                    <IconCreditCard size={15} className="text-gray-400" />
                    Alterar cartão
                    {assinatura.card_last_four && (
                      <span className="text-gray-400">
                        — {assinatura.card_brand
                          ? `${assinatura.card_brand.charAt(0).toUpperCase()}${assinatura.card_brand.slice(1).toLowerCase()}`
                          : 'Cartão'} •••• {assinatura.card_last_four}
                      </span>
                    )}
                  </span>
                  <IconArrowRight size={16} />
                </button>
              )}

              {/* Cancel */}
              {canCancel && !showCancelConfirm && (
                <button
                  onClick={() => setShowCancelConfirm(true)}
                  className="flex items-center justify-between w-full px-4 py-3 rounded-lg border border-red-100 text-sm font-medium text-red-500 hover:bg-red-50 transition"
                >
                  <span>Cancelar assinatura</span>
                  <IconX size={15} />
                </button>
              )}

              {/* Cancel confirmation */}
              {showCancelConfirm && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                  <p className="text-sm font-semibold text-red-700 mb-1">Confirmar cancelamento</p>
                  <p className="text-xs text-red-600 mb-4">
                    Ao cancelar, você perderá o acesso ao sistema ao fim do período já pago. Esta ação não pode ser desfeita.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleCancelar}
                      disabled={cancelling}
                      className="px-4 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700 transition disabled:opacity-50"
                    >
                      {cancelling ? 'Cancelando...' : 'Sim, cancelar'}
                    </button>
                    <button
                      onClick={() => setShowCancelConfirm(false)}
                      disabled={cancelling}
                      className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-xs font-semibold hover:bg-gray-50 transition disabled:opacity-50"
                    >
                      Manter assinatura
                    </button>
                  </div>
                </div>
              )}

            </div>
          </div>

          {/* Payment history */}
          {assinatura.asaas_subscription_id && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mt-4">
              <div className="flex items-center gap-2 mb-4">
                <IconReceipt size={16} className="text-gray-400" />
                <h3 className="text-sm font-semibold text-navy">Histórico de pagamentos</h3>
              </div>

              {loadingHistorico ? (
                <p className="text-sm text-gray-400 text-center py-4">Carregando histórico...</p>
              ) : historico.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Nenhum pagamento encontrado.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {historico.map((p) => {
                    const isPaid = p.status === 'RECEIVED' || p.status === 'CONFIRMED';
                    const isPending = p.status === 'PENDING';
                    const isOverdueP = p.status === 'OVERDUE';
                    return (
                      <div key={p.id} className="py-3 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isPaid ? 'bg-emerald-400' : isOverdueP ? 'bg-red-400' : 'bg-amber-400'}`} />
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-navy">
                              {formatCurrencyBR(p.value)}
                            </p>
                            <p className="text-xs text-gray-400">
                              Venc. {formatDateBR(p.dueDate)}
                              {p.paymentDate && ` · Pago ${formatDateBR(p.paymentDate)}`}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                            isPaid ? 'bg-emerald-100 text-emerald-700' :
                            isOverdueP ? 'bg-red-100 text-red-700' :
                            isPending ? 'bg-amber-100 text-amber-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {isPaid ? 'Pago' : isOverdueP ? 'Vencido' : isPending ? 'Pendente' : p.status}
                          </span>
                          {p.invoiceUrl && (
                            <a
                              href={p.invoiceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-gray-400 hover:text-navy transition"
                            >
                              <IconExternalLink size={13} />
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Trust footer */}
          <div className="flex items-center justify-center gap-2 mt-6 text-gray-400 text-xs">
            <IconShield size={13} />
            <span>Pagamentos processados com segurança via Asaas</span>
          </div>

        </div>
      </main>

      {/* Dialog: Alterar cartão */}
      <DialogBase
        open={showCardDialog}
        onClose={() => { setShowCardDialog(false); setCard(EMPTY_CARD); setHolder(EMPTY_HOLDER); }}
        title="Alterar cartão de cobrança"
        onSubmit={handleAtualizarCartao}
        size="sm"
        loading={updatingCard}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-500">O novo cartão será usado em todas as cobranças futuras e em cobranças pendentes desta assinatura.</p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Número do cartão</label>
              <input type="text" inputMode="numeric" placeholder="0000 0000 0000 0000" value={card.number} onChange={(e) => setCard(p => ({ ...p, number: fmtCardNumber(e.target.value) }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Nome no cartão</label>
              <input type="text" placeholder="NOME COMO NO CARTÃO" value={card.holder_name} onChange={(e) => setCard(p => ({ ...p, holder_name: e.target.value.toUpperCase() }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Validade</label>
              <input type="text" inputMode="numeric" placeholder="MM/AA" value={`${card.expiry_month}${card.expiry_year ? `/${card.expiry_year}` : ''}`} onChange={(e) => { const f = fmtExpiry(e.target.value); const [mm = '', yy = ''] = f.split('/'); setCard(p => ({ ...p, expiry_month: mm, expiry_year: yy })); }} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy" />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">CVV</label>
              <input type="text" inputMode="numeric" placeholder="000" maxLength={4} value={card.ccv} onChange={(e) => setCard(p => ({ ...p, ccv: e.target.value.replace(/\D/g, '').slice(0, 4) }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy" />
            </div>
          </div>

          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium mb-3">Dados do titular</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Nome completo</label>
                <input type="text" placeholder="Nome do titular" value={holder.name} onChange={(e) => setHolder(p => ({ ...p, name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">CPF / CNPJ</label>
                <input type="text" inputMode="numeric" placeholder="000.000.000-00" value={holder.cpf_cnpj} onChange={(e) => setHolder(p => ({ ...p, cpf_cnpj: fmtCpfCnpj(e.target.value) }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">E-mail</label>
                <input type="email" placeholder="email@exemplo.com" value={holder.email ?? ''} onChange={(e) => setHolder(p => ({ ...p, email: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Telefone (com DDD)</label>
                <input type="text" inputMode="numeric" placeholder="(11) 99999-9999" value={holder.phone ?? ''} onChange={(e) => setHolder(p => ({ ...p, phone: fmtPhone(e.target.value) }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">CEP</label>
                <input type="text" inputMode="numeric" placeholder="00000-000" value={holder.postal_code ?? ''} onChange={(e) => setHolder(p => ({ ...p, postal_code: fmtCep(e.target.value) }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Número (endereço)</label>
                <input type="text" placeholder="123" value={holder.address_number ?? ''} onChange={(e) => setHolder(p => ({ ...p, address_number: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-navy" />
              </div>
            </div>
          </div>
        </div>
      </DialogBase>
    </div>
  );
}
