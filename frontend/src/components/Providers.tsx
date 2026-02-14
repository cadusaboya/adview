'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { MantineProvider } from '@mantine/core';
import { ConfigProvider } from 'antd';
import { Toaster } from 'sonner';
import { SubscriptionProvider, useSubscription } from '@/contexts/SubscriptionContext';
import { isLoggedIn } from '@/services/auth';

const EXEMPT_PATHS = ['/', '/assinatura', '/assinar', '/assinar/pagamento', '/cadastro'];

function SubscriptionGuard({ children }: { children: React.ReactNode }) {
  const { assinatura, loading } = useSubscription();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!isLoggedIn()) return;
    if (EXEMPT_PATHS.includes(pathname)) return;
    if (assinatura && !assinatura.acesso_permitido) {
      router.replace('/assinar');
    }
  }, [assinatura, loading, pathname, router]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#0A192F',
          borderRadius: 4,
          fontFamily: 'var(--font-inter), system-ui, sans-serif',
        },
      }}
      getPopupContainer={(triggerNode) => triggerNode?.parentElement || document.body}
    >
      <MantineProvider
        defaultColorScheme="light"
        theme={{
          components: {
            ScrollArea: {
              styles: {
                root: {
                  border: 'none',
                  outline: 'none',
                },
                viewport: {
                  border: 'none',
                  outline: 'none',
                },
                scrollbar: {
                  border: 'none',
                  outline: 'none',
                },
              },
            },
          },
        }}
      >
        <SubscriptionProvider>
          <SubscriptionGuard>
            {children}
          </SubscriptionGuard>
        </SubscriptionProvider>
        <Toaster
          richColors
          position="bottom-right"
          expand={true}
          visibleToasts={9}
          gap={8}
        />
      </MantineProvider>
    </ConfigProvider>
  );
}
