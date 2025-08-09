import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import "./globals.css";
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { BusinessSwitcher } from '@/components/BusinessSwitcher';
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
          <div className="min-h-screen bg-background">
            {/* Navigation Header */}
            <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <div className="container max-w-7xl flex h-16 items-center justify-between">
                <div className="flex items-center gap-8">
                  <Link href="/" className="flex items-center space-x-2">
                    <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                      <span className="text-primary-foreground font-bold text-sm">D</span>
                    </div>
                    <span className="font-semibold text-lg">Dental Manager</span>
                  </Link>
                  
                  <nav className="hidden md:flex items-center space-x-6 text-sm">
                    <Link href="/" className="text-foreground/60 hover:text-foreground transition-colors">
                      Inicio
                    </Link>
                    <Link href="/time" className="text-foreground/60 hover:text-foreground transition-colors">
                      Tiempo
                    </Link>
                    <Link href="/fixed-costs" className="text-foreground/60 hover:text-foreground transition-colors">
                      Costos Fijos
                    </Link>
                    <Link href="/supplies" className="text-foreground/60 hover:text-foreground transition-colors">
                      Insumos
                    </Link>
                    <Link href="/services" className="text-foreground/60 hover:text-foreground transition-colors">
                      Servicios
                    </Link>
                    <Link href="/tariffs" className="text-foreground/60 hover:text-foreground transition-colors">
                      Tarifario
                    </Link>
                  </nav>
                </div>
                
                <div className="flex items-center gap-4">
                  <BusinessSwitcher />
                  <LanguageSwitcher />
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className="container max-w-7xl py-8">
              {children}
            </main>
          </div>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}