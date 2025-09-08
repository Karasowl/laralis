"use client";

import { useLocale, useTranslations } from 'next-intl';

// Small wrapper that provides a safe translator with fallback.
// It avoids noisy console errors when a key is missing and returns
// either the provided fallback or the key itself.
function normalizeEsText(s: string): string {
  // Quick runtime fixer for common mojibake/replacement issues in Spanish.
  // It’s intentionally conservative and only touches known patterns.
  const pairs: Array<[RegExp, string]> = [
    [/^�(?=[A-Za-zÁÉÍÓÚÑáéíóú])/g, '¿'],
    [/ci�n/gi, 'ción'],
    [/Informaci�n/gi, 'Información'],
    [/Configuraci�n/gi, 'Configuración'],
    [/descripci�n/gi, 'descripción'],
    [/educaci�n/gi, 'educación'],
    [/depreciaci�n/gi, 'depreciación'],
    [/categor�a/gi, 'categoría'],
    [/subcategor�a/gi, 'subcategoría'],
    [/cl�nic/gi, 'clínic'],
    [/opci�n/gi, 'opción'],
    [/acci�n/gi, 'acción'],
    [/g�nero/gi, 'género'],
    [/tel�fono/gi, 'teléfono'],
    [/direcci�n/gi, 'dirección'],
    [/per�odo/gi, 'período'],
    [/campa�a/gi, 'campaña'],
    [/n�mero/gi, 'número'],
    [/m�s/gi, 'más'],
    [/despu�s/gi, 'después'],
    [/Aqu�/g, 'Aquí'],
    [/qui�n/gi, 'quién'],
    [/refiri�/gi, 'refirió'],
  ];
  let out = s;
  for (const [re, to] of pairs) out = out.replace(re, to);
  return out;
}

export function useT(namespace?: string) {
  const t = useTranslations(namespace as any);
  const locale = useLocale();
  return (key: string, options?: Record<string, any>) => {
    const fallback = options?.fallback ?? key;
    try {
      // next-intl supports a `fallback` option in v3
      const value = t(key as any, { ...options, fallback });
      return locale === 'es' ? normalizeEsText(String(value)) : value;
    } catch (_err) {
      return fallback;
    }
  };
}
