export const instant = false;

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import AppShell from '@/components/AppShell';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SAGARA - Student Athletic Growth Analytics',
  description: 'Aplikasi Analisis Kebugaran Jasmani dan Kesiapan DUDI SMK Negeri 1 Karawang',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className={`${inter.className} bg-gray-50 text-gray-900 antialiased`}>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}