import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import "./globals.css";
import HeaderChrome from '@/components/HeaderChrome';
import { Toaster } from '@/components/ui/toaster';
import { WorkspaceProvider } from '@/contexts/workspace-context';
import Link from 'next/link';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <NextIntlClientProvider messages={messages}>
          <WorkspaceProvider>
            <div className="min-h-screen bg-background">
              <HeaderChrome />
              {/* Main Content */}
              <main className="container max-w-7xl py-8">
                {children}
              </main>
            </div>
            <Toaster />
          </WorkspaceProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}