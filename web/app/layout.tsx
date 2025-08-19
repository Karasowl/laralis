import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import "./globals.css";
import HeaderChrome from '@/components/HeaderChrome';
import { Toaster } from '@/components/ui/toaster';
import { WorkspaceProvider } from '@/contexts/workspace-context';
import { ThemeProvider } from '@/components/providers/theme-provider';
import Link from 'next/link';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                if (localStorage.getItem('laralis-ui-theme') === 'dark' || 
                    (!localStorage.getItem('laralis-ui-theme') && 
                     window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.classList.add('dark')
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        <ThemeProvider defaultTheme="system" storageKey="laralis-ui-theme">
          <NextIntlClientProvider messages={messages}>
            <WorkspaceProvider>
              <div className="min-h-screen bg-background text-foreground">
                <HeaderChrome />
                {/* Main Content */}
                <main className="container max-w-7xl py-4 sm:py-6 lg:py-8 px-4 sm:px-6 lg:px-8">
                  {children}
                </main>
              </div>
              <Toaster />
            </WorkspaceProvider>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}