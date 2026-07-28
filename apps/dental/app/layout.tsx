import { getMessages, getLocale } from 'next-intl/server';
import "./globals.css";
import { Toaster } from 'sonner';
import { WorkspaceProvider } from '@/contexts/workspace-context';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { BrowserExtensionsCleanup } from '@/components/providers/browser-extensions-cleanup';
import { IntlProvider } from '@/components/providers/intl-provider';
import { SwrProvider } from '@/components/providers/swr-provider';
import { FloatingAssistant } from '@/components/ai-assistant/FloatingAssistant';
import { TawkChat } from '@/components/tawk-chat';
import { getAuthBackend } from '@/lib/auth/convex-session';
import { ConvexAuthNextjsServerProvider } from '@convex-dev/auth/nextjs/server';
import { ConvexAuthClientProvider } from '@/components/providers/convex-auth-provider';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [messages, locale] = await Promise.all([
    getMessages(),
    getLocale()
  ]);

  // Convex Auth is mounted only when AUTH_BACKEND is convex/dual (default supabase
  // => the Convex client/provider are never constructed; behavior is unchanged).
  const convexAuthOn = getAuthBackend() !== 'supabase';

  const appStack = (
    <IntlProvider messages={messages} locale={locale}>
      <SwrProvider>
        <WorkspaceProvider>
          {children}
          <FloatingAssistant />
          <TawkChat />
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
      </SwrProvider>
    </IntlProvider>
  );

  const tree = (
    <html lang={locale} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning data-gramm="false" data-gramm_editor="false" data-enable-grammarly="false">
        <BrowserExtensionsCleanup />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          storageKey="laralis-theme"
        >
          {convexAuthOn ? <ConvexAuthClientProvider>{appStack}</ConvexAuthClientProvider> : appStack}
        </ThemeProvider>
      </body>
    </html>
  );

  return convexAuthOn ? <ConvexAuthNextjsServerProvider>{tree}</ConvexAuthNextjsServerProvider> : tree;
}
