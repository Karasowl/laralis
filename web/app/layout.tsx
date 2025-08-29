import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import "./globals.css";
import { Toaster } from 'sonner';
import { WorkspaceProvider } from '@/contexts/workspace-context';
import { ThemeProvider } from '@/components/providers/theme-provider';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const messages = await getMessages();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ThemeProvider 
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="laralis-theme"
        >
          <NextIntlClientProvider messages={messages}>
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
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}