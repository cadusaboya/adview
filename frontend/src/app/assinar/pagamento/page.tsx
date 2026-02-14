'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import {
  IconArrowLeft,
  IconCreditCard,
  IconLock,
  IconShield,
  IconCrown,
  IconStar,
  IconRocket,
  IconCheck,
  IconArrowRight,
  IconCalendar,
  IconUsers,
} from '@tabler/icons-react';
import { getPlanos, assinar } from '@/services/assinatura';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { formatCurrencyBR } from '@/lib/formatters';
import type { PlanoAssinatura, CreditCardData, CardHolderInfo } from '@/types/assinatura';

const PLAN_ICONS: Record<string, React.ReactNode> = {
  essencial: <IconStar size={22} />,
  profissional: <IconCrown size={22} />,
  evolution: <IconRocket size={22} />,
};

const EMPTY_CARD: CreditCardData = {
  holder_name: '',
  number: '',
  expiry_month: '',
  expiry_year: '',
  ccv: '',
};

const EMPTY_HOLDER: CardHolderInfo = {
  name: '',
  cpf_cnpj: '',
  email: '',
  phone: '',
  postal_code: '',
  address_number: '',
};

function formatCardNumber(value: string) {
  return value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
}

function formatExpiry(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 4);
  if (digits.length > 2) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return digits;
}

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
}

function formatCep(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length > 5) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return digits;
}

function translateAsaasError(detail: string): string {
  const d = detail.toLowerCase();
  if (d.includes('recusado') || d.includes('declined')) return 'Cartão recusado pelo banco. Verifique os dados ou tente outro cartão.';
  if (d.includes('saldo insuficiente') || d.includes('insufficient funds') || d.includes('fundos')) return 'Saldo insuficiente. Tente outro cartão.';
  if (d.includes('vencido') || d.includes('expirado') || d.includes('expired') || d.includes('validade')) return 'Cartão vencido. Verifique a data de validade.';
  if (d.includes('cvv') || d.includes('código de segurança') || d.includes('security code')) return 'Código de segurança (CVV) inválido.';
  if ((d.includes('número') || d.includes('number')) && (d.includes('inválido') || d.includes('invalid'))) return 'Número do cartão inválido.';
  if (d.includes('limite')) return 'Limite do cartão excedido. Tente outro cartão.';
  if ((d.includes('cpf') || d.includes('cnpj')) && (d.includes('inválido') || d.includes('invalid'))) return 'CPF/CNPJ do titular inválido. Verifique os dados.';
  if (d.includes('nome do portador') || d.includes('holder name')) return 'Nome no cartão inválido.';
  if (d.includes('cep') || d.includes('postal') || d.includes('endereço') || d.includes('address')) return 'CEP ou endereço inválido.';
  if (d.includes('telefone') || d.includes('phone')) return 'Telefone inválido. Verifique o número com DDD.';
  if (d.includes('e-mail') || d.includes('email')) return 'E-mail inválido.';
  if (d.includes('gateway') || d.includes('processamento')) return 'Erro no gateway de pagamento. Tente novamente.';
  return detail;
}

function formatCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14);
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2');
}


function PagamentoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refresh } = useSubscription();

  const planoSlug = searchParams.get('plano') ?? '';
  const ciclo = (searchParams.get('ciclo') ?? 'MONTHLY') as 'MONTHLY' | 'YEARLY';

  const [plano, setPlano] = useState<PlanoAssinatura | null>(null);
  const [loadingPlano, setLoadingPlano] = useState(true);
  const [card, setCard] = useState<CreditCardData>(EMPTY_CARD);
  const [holder, setHolder] = useState<CardHolderInfo>(EMPTY_HOLDER);
  const [submitting, setSubmitting] = useState(false);
  const [cpfCnpjWarning, setCpfCnpjWarning] = useState(false);

  useEffect(() => {
    if (!planoSlug) { router.replace('/assinar'); return; }
    getPlanos()
      .then((planos) => {
        const found = planos.find((p) => p.slug === planoSlug);
        if (!found) { router.replace('/assinar'); return; }
        setPlano(found);
      })
      .catch(() => router.replace('/assinar'))
      .finally(() => setLoadingPlano(false));
  }, [planoSlug, router]);

  const precoMes = plano
    ? ciclo === 'YEARLY' ? parseFloat(plano.preco_anual) / 12 : parseFloat(plano.preco_mensal)
    : 0;

  const precoAnual = plano ? parseFloat(plano.preco_anual) : 0;
  const precoMensal = plano ? parseFloat(plano.preco_mensal) : 0;
  const economia = precoMensal * 12 - precoAnual;

  const handleConfirmar = async () => {
    if (!plano) return;
    setCpfCnpjWarning(false);
    setSubmitting(true);

    try {
      if (
        !card.holder_name.trim() ||
        card.number.replace(/\s/g, '').length < 16 ||
        !card.expiry_month ||
        !card.expiry_year ||
        card.ccv.length < 3 ||
        !holder.name.trim() ||
        holder.cpf_cnpj.replace(/\D/g, '').length < 11 ||
        !holder.email?.trim() ||
        (holder.phone?.replace(/\D/g, '') ?? '').length < 10 ||
        !holder.postal_code?.trim() ||
        !holder.address_number?.trim()
      ) {
        toast.error('Preencha todos os dados do cartão.');
        return;
      }

      await assinar({
        plano_slug: plano.slug,
        ciclo,
        billing_type: 'CREDIT_CARD',
        credit_card: { ...card, number: card.number.replace(/\s/g, '') },
        holder_info: holder,
      });

      await refresh();
      toast.success('Assinatura ativada com sucesso!');
      router.push('/assinatura');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      if (detail === 'CPF_CNPJ_MISSING') {
        setCpfCnpjWarning(true);
      } else if (detail) {
        toast.error(translateAsaasError(detail));
      } else {
        toast.error('Erro ao processar assinatura. Verifique os dados e tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingPlano) {
    return (
      <div className="min-h-screen bg-[#0A192F] flex items-center justify-center">
        <p className="text-white/50 text-sm">Carregando...</p>
      </div>
    );
  }

  if (!plano) return null;

  return (
    <div className="min-h-screen bg-[#0A192F] px-6 py-10">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/assinar')}
            className="flex items-center gap-1.5 text-white/60 hover:text-white transition text-sm"
          >
            <IconArrowLeft size={18} />
            Voltar
          </button>
          <h1 className="text-xl font-serif font-bold text-white">Finalizar assinatura</h1>
        </div>

        {/* CPF/CNPJ warning */}
        {cpfCnpjWarning && (
          <div className="bg-amber-500/15 border border-amber-400/40 rounded-xl px-4 py-3 flex items-start gap-3">
            <span className="text-amber-400 text-base mt-0.5">⚠</span>
            <div>
              <p className="text-amber-300 font-semibold text-sm">CPF/CNPJ não cadastrado</p>
              <p className="text-amber-200/80 text-sm mt-0.5">
                Preencha o CPF ou CNPJ nas{' '}
                <a href="/empresa" className="underline font-medium text-amber-300 hover:text-amber-200">
                  configurações da empresa
                </a>
                {' '}e volte aqui.
              </p>
            </div>
          </div>
        )}

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ── LEFT: Payment ── */}
          <div className="flex flex-col gap-4">

            {/* Credit card form */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-5">
                  <IconCreditCard size={16} className="text-[#D4AF37]" />
                  <h3 className="text-white font-semibold text-sm">Dados do cartão</h3>
                  <div className="ml-auto flex items-center gap-1 text-white/40 text-xs">
                    <IconLock size={12} />
                    Seguro
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-white/60 text-xs mb-1.5">Número do cartão</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      autoComplete="cc-number"
                      placeholder="0000 0000 0000 0000"
                      value={card.number}
                      onChange={(e) => setCard(p => ({ ...p, number: formatCardNumber(e.target.value) }))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#D4AF37] transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-white/60 text-xs mb-1.5">Validade</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-exp"
                        placeholder="MM/AA"
                        value={`${card.expiry_month}${card.expiry_year ? `/${card.expiry_year}` : ''}`}
                        onChange={(e) => {
                          const formatted = formatExpiry(e.target.value);
                          const [mm = '', yy = ''] = formatted.split('/');
                          setCard(p => ({ ...p, expiry_month: mm, expiry_year: yy }));
                        }}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#D4AF37] transition"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 text-xs mb-1.5">CVV</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="cc-csc"
                        placeholder="000"
                        maxLength={4}
                        value={card.ccv}
                        onChange={(e) => setCard(p => ({ ...p, ccv: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#D4AF37] transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-white/60 text-xs mb-1.5">Nome no cartão</label>
                    <input
                      type="text"
                      autoComplete="cc-name"
                      placeholder="NOME COMO NO CARTÃO"
                      value={card.holder_name}
                      onChange={(e) => setCard(p => ({ ...p, holder_name: e.target.value.toUpperCase() }))}
                      className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#D4AF37] transition"
                    />
                  </div>

                  <div className="border-t border-white/10 pt-1">
                    <p className="text-white/40 text-xs mb-3 uppercase tracking-wide font-medium">Dados do titular</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-white/60 text-xs mb-1.5">Nome completo</label>
                      <input
                        type="text"
                        placeholder="Nome do titular"
                        value={holder.name}
                        onChange={(e) => setHolder(p => ({ ...p, name: e.target.value }))}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#D4AF37] transition"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 text-xs mb-1.5">CPF / CNPJ</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="000.000.000-00"
                        value={holder.cpf_cnpj}
                        onChange={(e) => setHolder(p => ({ ...p, cpf_cnpj: formatCpfCnpj(e.target.value) }))}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#D4AF37] transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-white/60 text-xs mb-1.5">E-mail</label>
                      <input
                        type="email"
                        placeholder="email@exemplo.com"
                        value={holder.email ?? ''}
                        onChange={(e) => setHolder(p => ({ ...p, email: e.target.value }))}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#D4AF37] transition"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 text-xs mb-1.5">Telefone (com DDD)</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="(11) 99999-9999"
                        value={holder.phone ?? ''}
                        onChange={(e) => setHolder(p => ({ ...p, phone: formatPhone(e.target.value) }))}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#D4AF37] transition"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-white/60 text-xs mb-1.5">CEP</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="00000-000"
                        value={holder.postal_code ?? ''}
                        onChange={(e) => setHolder(p => ({ ...p, postal_code: formatCep(e.target.value) }))}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#D4AF37] transition"
                      />
                    </div>
                    <div>
                      <label className="block text-white/60 text-xs mb-1.5">Número</label>
                      <input
                        type="text"
                        placeholder="123"
                        value={holder.address_number ?? ''}
                        onChange={(e) => setHolder(p => ({ ...p, address_number: e.target.value }))}
                        className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2.5 text-white placeholder-white/30 text-sm focus:outline-none focus:border-[#D4AF37] transition"
                      />
                    </div>
                  </div>
                </div>
              </div>

            {/* Confirm button */}
            <button
              onClick={handleConfirmar}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#D4AF37] text-[#0A192F] font-bold text-sm hover:bg-[#c9a42e] transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Processando...' : (
                <>
                  Confirmar e assinar
                  <IconArrowRight size={16} />
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-white/30 text-xs">
              <IconShield size={13} />
              <span>Pagamento seguro via Asaas · Cancele quando quiser</span>
            </div>
          </div>

          {/* ── RIGHT: Plan summary ── */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col gap-5">

            {/* Plan header */}
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-[#D4AF37]/10 flex items-center justify-center text-[#D4AF37]">
                {PLAN_ICONS[plano.slug]}
              </div>
              <div>
                <p className="text-white font-bold text-base font-serif">{plano.nome}</p>
                <p className="text-white/40 text-xs">{plano.subtitulo}</p>
              </div>
            </div>

            {/* Pricing */}
            <div className="bg-white/5 rounded-xl p-4">
              <div className="flex items-end justify-between mb-1">
                <div>
                  <p className="text-white/40 text-xs mb-0.5">
                    {ciclo === 'YEARLY' ? 'Equivalente a' : 'Valor mensal'}
                  </p>
                  <p className="text-[#D4AF37] text-2xl font-bold">
                    {formatCurrencyBR(precoMes)}
                    <span className="text-white/40 text-xs font-normal ml-1">/mês</span>
                  </p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/10 text-white/60">
                  {ciclo === 'YEARLY' ? 'Anual' : 'Mensal'}
                </span>
              </div>

              {ciclo === 'YEARLY' && (
                <div className="mt-3 pt-3 border-t border-white/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-white/50 text-sm flex items-center gap-1.5">
                      <IconCalendar size={13} className="text-white/30" />
                      Cobrado agora
                    </p>
                    <p className="text-white font-bold text-sm">{formatCurrencyBR(precoAnual)}</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-green-400 text-xs">Você economiza</p>
                    <p className="text-green-400 text-xs font-semibold">{formatCurrencyBR(economia)}</p>
                  </div>
                </div>
              )}

              {ciclo === 'MONTHLY' && (
                <div className="mt-3 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <p className="text-white/50 text-sm flex items-center gap-1.5">
                      <IconCalendar size={13} className="text-white/30" />
                      Cobrado agora
                    </p>
                    <p className="text-white font-bold text-sm">{formatCurrencyBR(precoMensal)}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Users */}
            <div className="flex items-center gap-2 text-white/50 text-sm">
              <IconUsers size={14} className="text-white/30" />
              <span>
                {plano.max_usuarios === 0 ? 'Usuários ilimitados' : `Até ${plano.max_usuarios} ${plano.max_usuarios === 1 ? 'usuário' : 'usuários'}`}
              </span>
            </div>

            {/* Features */}
            <div className="border-t border-white/10 pt-4">
              <p className="text-white/40 text-xs uppercase tracking-wide font-medium mb-3">Incluso no plano</p>
              <ul className="space-y-2">
                {plano.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-white/70 text-sm">
                    <IconCheck size={14} className="text-[#D4AF37] flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}

export default function PagamentoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0A192F] flex items-center justify-center"><p className="text-white/50 text-sm">Carregando...</p></div>}>
      <PagamentoContent />
    </Suspense>
  );
}
