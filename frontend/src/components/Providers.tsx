'use client';

import { MantineProvider } from '@mantine/core';
import { ConfigProvider } from 'antd';
import { Toaster } from 'sonner';

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
        {children}
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
