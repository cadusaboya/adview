import { useState } from 'react';
import { useSubscription } from '@/contexts/SubscriptionContext';

export type GuardedFeature = 'pdf_export';

const FEATURE_LABELS: Record<GuardedFeature, string> = {
  pdf_export: 'Exportação de relatórios em PDF',
};

function isPlanAllowed(slug: string | undefined, feature: GuardedFeature): boolean {
  switch (feature) {
    case 'pdf_export':
      return slug === 'profissional' || slug === 'evolution';
    default:
      return true;
  }
}

export function useUpgradeGuard() {
  const { assinatura } = useSubscription();
  const [blocked, setBlocked] = useState<GuardedFeature | null>(null);

  const hasFeature = (feature: GuardedFeature): boolean => {
    if (!assinatura) return true; // backend will enforce
    if (assinatura.trial_ativo) return true; // trial usa plano profissional, acesso completo
    const slug = assinatura.plano?.slug;
    return isPlanAllowed(slug, feature);
  };

  const guard = (feature: GuardedFeature, fn: () => void) => () => {
    if (!hasFeature(feature)) {
      setBlocked(feature);
      return;
    }
    fn();
  };

  const guardAsync = (feature: GuardedFeature, fn: () => Promise<void>) => async () => {
    if (!hasFeature(feature)) {
      setBlocked(feature);
      return;
    }
    await fn();
  };

  return {
    guard,
    guardAsync,
    hasFeature,
    blockedFeature: blocked,
    blockedFeatureLabel: blocked ? FEATURE_LABELS[blocked] : undefined,
    closeUpgradeDialog: () => setBlocked(null),
    isUpgradeDialogOpen: blocked !== null,
  };
}
