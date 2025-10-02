'use client';

import { NextIntlClientProvider } from 'next-intl';
import { ReactNode } from 'react';

interface IntlProviderProps {
  messages: any;
  locale: string;
  children: ReactNode;
}

export function IntlProvider({ messages, locale, children }: IntlProviderProps) {
  // Default timezone to avoid next-intl warnings and provide consistent formatting
  const timeZone = 'America/Mexico_City';
  return (
    <NextIntlClientProvider
      messages={messages}
      locale={locale}
      timeZone={timeZone}
      onError={(error) => {
        try {
          // @ts-ignore next-intl error shape
          if (error?.code === 'MISSING_MESSAGE') return;
        } catch {}
        // eslint-disable-next-line no-console
        console.error(error);
      }}
    >
      {children}
    </NextIntlClientProvider>
  );
}
