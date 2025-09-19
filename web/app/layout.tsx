import { getMessages, getLocale } from 'next-intl/server';
import "./globals.css";
import { Toaster } from 'sonner';
import { WorkspaceProvider } from '@/contexts/workspace-context';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { BrowserExtensionsCleanup } from '@/components/providers/browser-extensions-cleanup';
import { IntlProvider } from '@/components/providers/intl-provider';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [messages, locale] = await Promise.all([
    getMessages(),
    getLocale()
  ]);

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false">
        <BrowserExtensionsCleanup />
        <ThemeProvider 
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="laralis-theme"
        >
          <IntlProvider messages={messages} locale={locale}>
            <WorkspaceProvider>
              {children}
              <Toaster
                richColors
                position="top-right"
                toastOptions={{
                  style: {
                    borderRadius: '12px',
                  },
                }}
              />
            </WorkspaceProvider>
          </IntlProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
