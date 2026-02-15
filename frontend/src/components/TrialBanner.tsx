'use client';

import { useSubscription } from '@/contexts/SubscriptionContext';
import { useRouter } from 'next/navigation';
import { IconAlertCircle, IconClock } from '@tabler/icons-react';

export function TrialBanner() {
  const { assinatura, loading } = useSubscription();
  const router = useRouter();

  if (loading || !assinatura) return null;

  if (assinatura.status === 'payment_failed') {
    return (
      <div className="flex items-center justify-between px-4 py-2 text-sm font-medium bg-red-600 text-white">
        <div className="flex items-center gap-2">
          <IconAlertCircle size={16} />
          <span>Pagamento recusado. Regularize sua assinatura para recuperar o acesso.</span>
        </div>
        <button
          onClick={() => router.push('/assinatura')}
          className="ml-4 underline font-semibold hover:no-underline whitespace-nowrap"
        >
          Ver detalhes
        </button>
      </div>
    );
  }

  if (assinatura.status === 'overdue') {
    return (
      <div className="flex items-center justify-between px-4 py-2 text-sm font-medium bg-orange-500 text-white">
        <div className="flex items-center gap-2">
          <IconAlertCircle size={16} />
          <span>Pagamento em atraso. Regularize para evitar a suspensão do acesso.</span>
        </div>
        <button
          onClick={() => router.push('/assinatura')}
          className="ml-4 underline font-semibold hover:no-underline whitespace-nowrap"
        >
          Regularizar
        </button>
      </div>
    );
  }

  if (assinatura.status !== 'trial' || !assinatura.trial_ativo) return null;

  const dias = assinatura.dias_trial_restantes;
  const urgente = dias <= 2;

  const mensagem =
    dias === 0
      ? 'Seu período de teste expira hoje!'
      : dias === 1
      ? 'Seu período de teste expira amanhã!'
      : `Seu período de teste expira em ${dias} dias.`;

  return (
    <div
      className={`flex items-center justify-between px-4 py-2 text-sm font-medium ${
        urgente ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'
      }`}
    >
      <div className="flex items-center gap-2">
        {urgente ? <IconAlertCircle size={16} /> : <IconClock size={16} />}
        <span>{mensagem}</span>
      </div>
      <button
        onClick={() => router.push('/assinar')}
        className="ml-4 underline font-semibold hover:no-underline whitespace-nowrap"
      >
        Assinar agora
      </button>
    </div>
  );
}
