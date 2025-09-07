"use client";

import { useTranslations } from 'next-intl';

// Small wrapper that provides a safe translator with fallback.
// It avoids noisy console errors when a key is missing and returns
// either the provided fallback or the key itself.
export function useT(namespace?: string) {
  const t = useTranslations(namespace as any);
  return (key: string, options?: Record<string, any>) => {
    const fallback = options?.fallback ?? key;
    try {
      // next-intl supports a `fallback` option in v3
      return t(key as any, { ...options, fallback });
    } catch (_err) {
      return fallback;
    }
  };
}

