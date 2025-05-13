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
  title: 'VisionCraft - Создание Видения Продукта',
  description: 'Помощник для формирования видения продукта с использованием AI.',
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
          "font-sans antialiased flex flex-col min-h-screen"
        )}
      >
        <AppHeader />
        <main className="flex-grow container mx-auto px-4 py-8">
          {children}
        </main>
        <footer className="py-6 text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} VisionCraft. Все права защищены.
        </footer>
        <Toaster />
      </body>
    </html>
  );
}
