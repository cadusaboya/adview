'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { IconCheck, IconCrown, IconStar, IconRocket, IconArrowLeft } from '@tabler/icons-react';
import { getPlanos } from '@/services/assinatura';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { formatCurrencyBR } from '@/lib/formatters';
import type { PlanoAssinatura } from '@/types/assinatura';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const PLAN_ICONS: Record<string, React.ReactNode> = {
  essencial: <IconStar size={28} />,
  profissional: <IconCrown size={28} />,
  evolution: <IconRocket size={28} />,
};

export default function AssinarPage() {
  const [planos, setPlanos] = useState<PlanoAssinatura[]>([]);
  const [loadingPlanos, setLoadingPlanos] = useState(true);
  const [ciclo, setCiclo] = useState<'MONTHLY' | 'YEARLY'>('MONTHLY');
  const { assinatura } = useSubscription();
  const router = useRouter();

  useEffect(() => {
    getPlanos()
      .then(setPlanos)
      .catch(() => toast.error('Erro ao carregar planos'))
      .finally(() => setLoadingPlanos(false));
  }, []);

  useEffect(() => {
    if (assinatura?.status === 'active') {
      router.replace('/dashboard');
    }
  }, [assinatura, router]);

  const handleSelectPlano = (plano: PlanoAssinatura) => {
    router.push(`/assinar/pagamento?plano=${plano.slug}&ciclo=${ciclo}`);
  };

  const getPreco = (plano: PlanoAssinatura) => {
    if (ciclo === 'YEARLY') return parseFloat(plano.preco_anual) / 12;
    return parseFloat(plano.preco_mensal);
  };

  const getEconomia = (plano: PlanoAssinatura) => {
    return parseFloat(plano.preco_mensal) * 12 - parseFloat(plano.preco_anual);
  };

  const isExpired = assinatura && !assinatura.acesso_permitido;

  return (
    <div className="min-h-screen bg-[#0A192F] flex flex-col justify-center px-6 py-10">
      <div className="max-w-5xl mx-auto w-full flex flex-col gap-5">

        {/* Header */}
        <div className="text-center">
          <div className="relative flex items-center justify-center mb-2">
            <button
              onClick={() => router.push('/assinatura')}
              className="absolute left-0 flex items-center gap-1 text-white/60 hover:text-white transition text-sm"
            >
              <IconArrowLeft size={18} />
              Voltar
            </button>
            <h1 className="text-3xl font-serif font-bold text-white">
              {isExpired ? 'Seu período de teste encerrou' : 'Escolha seu plano'}
            </h1>
          </div>
          <p className="text-sm text-white/60">
            {isExpired
              ? 'Para continuar usando o Vincor, selecione um plano abaixo.'
              : 'Escolha o plano ideal para o seu escritório. Cancele quando quiser.'}
          </p>
          {assinatura?.trial_ativo && !isExpired && (
            <p className="mt-1 text-amber-400 text-sm font-medium">
              {assinatura.dias_trial_restantes === 0
                ? 'Período de teste expira hoje!'
                : `${assinatura.dias_trial_restantes} dias restantes no seu período de teste.`}
            </p>
          )}
        </div>

        {/* Billing cycle tabs */}
        <div className="flex items-center justify-center">
          <Tabs value={ciclo} onValueChange={(v) => setCiclo(v as 'MONTHLY' | 'YEARLY')}>
            <TabsList className="bg-[#0d2040] border border-[#D4AF37]/30 rounded-full p-1 h-auto">
              <TabsTrigger value="MONTHLY" className="rounded-full px-5 py-1.5 text-white/60 data-[state=active]:bg-white data-[state=active]:text-[#0A192F] data-[state=active]:shadow-none">
                Mensal
              </TabsTrigger>
              <TabsTrigger value="YEARLY" className="rounded-full px-5 py-1.5 text-white/60 data-[state=active]:bg-white data-[state=active]:text-[#0A192F] data-[state=active]:shadow-none">
                Anual
                <span className="ml-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                  2 meses grátis
                </span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Plan Cards */}
        {loadingPlanos ? (
          <div className="flex justify-center py-10">
            <p className="text-white/50">Carregando planos...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 items-center">
            {planos.map((plano) => {
              const isPro = plano.slug === 'profissional';
              const precoMes = getPreco(plano);
              const economia = getEconomia(plano);

              return (
                <div
                  key={plano.id}
                  className={`rounded-2xl flex flex-col transition-transform ${
                    isPro
                      ? 'bg-white shadow-2xl scale-105 ring-2 ring-[#D4AF37] p-7'
                      : 'bg-[#0d2040] border border-[#D4AF37]/30 p-6'
                  }`}
                >
                  {isPro && (
                    <div className="text-center mb-3">
                      <span className="text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide bg-[#D4AF37] text-[#0A192F]">
                        Mais popular
                      </span>
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-1">
                    <span className={isPro ? 'text-[#0A192F]' : 'text-[#D4AF37]'}>{PLAN_ICONS[plano.slug]}</span>
                    <h2 className={`text-xl font-serif font-bold ${isPro ? 'text-[#0A192F]' : 'text-[#D4AF37]'}`}>{plano.nome}</h2>
                  </div>

                  <p className={`text-xs mb-4 ${isPro ? 'text-gray-500' : 'text-white/60'}`}>
                    {plano.subtitulo}
                  </p>

                  <div className={`${isPro ? 'text-[#0A192F]' : 'text-[#D4AF37]'}`}>
                    <span className="text-3xl font-bold">{formatCurrencyBR(precoMes)}</span>
                    <span className={`text-xs ml-1 ${isPro ? 'text-gray-400' : 'text-white/50'}`}>/mês</span>
                  </div>

                  <div className="mb-4 mt-0.5 h-4">
                    {ciclo === 'YEARLY' && (
                      <p className={`text-xs ${isPro ? 'text-gray-400' : 'text-white/50'}`}>
                        {formatCurrencyBR(parseFloat(plano.preco_anual))}/ano
                        {' · '}
                        <span className="text-green-400">economize {formatCurrencyBR(economia)}</span>
                      </p>
                    )}
                  </div>

                  <ul className="space-y-2 text-xs mb-5">
                    {plano.features.map((feature, i) => (
                      <li key={i} className={`flex items-start gap-2 ${isPro ? 'text-gray-700' : 'text-white/80'}`}>
                        <IconCheck size={13} className={`mt-0.5 flex-shrink-0 ${isPro ? 'text-green-500' : 'text-[#D4AF37]'}`} />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  {plano.slug === 'evolution' ? (
                    <a
                      href="https://wa.me/5591984147769?text=Ol%C3%A1%2C+quero+saber+mais+sobre+o+plano+Evolution"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`w-full py-2.5 rounded-xl font-semibold text-sm transition flex items-center justify-center ${
                        isPro
                          ? 'bg-[#0A192F] text-white hover:bg-[#0A192F]/90'
                          : 'bg-[#D4AF37] text-[#0A192F] hover:bg-[#c9a42e]'
                      }`}
                    >
                      Falar com Consultor
                    </a>
                  ) : (
                    <button
                      onClick={() => handleSelectPlano(plano)}
                      className={`w-full py-2.5 rounded-xl font-semibold text-sm transition ${
                        isPro
                          ? 'bg-[#0A192F] text-white hover:bg-[#0A192F]/90'
                          : 'bg-[#D4AF37] text-[#0A192F] hover:bg-[#c9a42e]'
                      }`}
                    >
                      Assinar agora
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-white/30 text-xs">
          Cancele quando quiser · Pagamento seguro via Asaas
        </p>
      </div>
    </div>
  );
}
