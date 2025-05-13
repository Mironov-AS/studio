import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Using Inter as a fallback, Geist is primary
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { cn } from '@/lib/utils';
import AppHeader from '@/components/app/AppHeader';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'cyrillic'], // Added cyrillic subset
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin', 'cyrillic'], // Added cyrillic subset
});

export const metadata: Metadata = {
  title: 'AI Мастерская | Ваши Инструменты для Продуктов',
  description: 'Коллекция AI-инструментов для помощи в создании, анализе и управлении продуктами.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <body 
        className={cn(
          geistSans.variable, 
          geistMono.variable, 
          "font-sans antialiased flex flex-col min-h-screen bg-background"
        )}
      >
        <AppHeader />
        <main className="flex-grow container mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="py-6 text-center text-sm text-muted-foreground border-t">
          © {new Date().getFullYear()} AI Мастерская. Все права защищены.
        </footer>
        <Toaster />
      </body>
    </html>
  );
}
