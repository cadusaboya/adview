'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getAssinaturaStatus } from '@/services/assinatura';
import { isLoggedIn } from '@/services/auth';
import type { AssinaturaStatus } from '@/types/assinatura';

interface SubscriptionContextValue {
  assinatura: AssinaturaStatus | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

const SubscriptionContext = createContext<SubscriptionContextValue>({
  assinatura: null,
  loading: true,
  refresh: async () => {},
});

const CACHE_KEY = 'vincor_assinatura_cache';

function readCache(): AssinaturaStatus | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as AssinaturaStatus) : null;
  } catch {
    return null;
  }
}

function writeCache(data: AssinaturaStatus | null) {
  try {
    if (data) sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    else sessionStorage.removeItem(CACHE_KEY);
  } catch { /* ignore */ }
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [assinatura, setAssinatura] = useState<AssinaturaStatus | null>(() => {
    if (typeof window !== 'undefined') return readCache();
    return null;
  });
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!isLoggedIn()) {
      setAssinatura(null);
      writeCache(null);
      setLoading(false);
      return;
    }
    try {
      const data = await getAssinaturaStatus();
      setAssinatura(data);
      writeCache(data);
    } catch {
      setAssinatura(null);
      writeCache(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <SubscriptionContext.Provider value={{ assinatura, loading, refresh }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  return useContext(SubscriptionContext);
}
