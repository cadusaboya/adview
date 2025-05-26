import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

import { MantineProvider } from '@mantine/core';
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Meu App',
  description: 'Descrição do app',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-br">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <MantineProvider
          theme={{ colorScheme: 'light' }}
          withGlobalStyles
          withNormalizeCSS
        >
            {children}
            <Toaster richColors />
        </MantineProvider>
      </body>
    </html>
  );
}
