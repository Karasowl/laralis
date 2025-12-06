import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';
import enMessages from '../messages/en.json';
import esMessages from '../messages/es.json';
import enOverrides from '../messages/en-overrides.json';
import esOverrides from '../messages/es-overrides.json';
import tariffsEn from '../messages/tariffs.en.json';
import tariffsEs from '../messages/tariffs.es.json';
import reportsEn from '../messages/reports.en.json';
import reportsEs from '../messages/reports.es.json';
import expensesEn from '../messages/expenses.en.json';
import expensesEs from '../messages/expenses.es.json';
import aiAssistantEn from '../messages/ai-assistant.en.json';
import aiAssistantEs from '../messages/ai-assistant.es.json';
import versionEn from '../messages/version.en.json';
import versionEs from '../messages/version.es.json';

export default getRequestConfig(async () => {
  const cookieStore = cookies();
  const locale = cookieStore.get('locale')?.value || 'en';

  const base = (locale === 'es' ? esMessages : enMessages) as Record<string, any>;

  // Lightweight deep merge helper
  const deepMerge = (target: any, source: any) => {
    for (const key of Object.keys(source)) {
      const sv = (source as any)[key];
      if (sv && typeof sv === 'object' && !Array.isArray(sv)) {
        if (!target[key] || typeof target[key] !== 'object') target[key] = {};
        deepMerge(target[key], sv);
      } else {
        target[key] = sv;
      }
    }
    return target;
  };

  let messages = base;
  if (locale === 'es') {
    // Fallback to English for any missing keys, then apply ES overrides
    const merged = deepMerge({ ...enMessages }, base);
    messages = deepMerge(merged, esOverrides);
  } else if (locale === 'en') {
    messages = deepMerge({ ...base }, enOverrides);
  }

  // Merge section-specific bundles
  const sectionBundles = locale === 'es'
    ? [tariffsEs, reportsEs, expensesEs, aiAssistantEs, versionEs]
    : [tariffsEn, reportsEn, expensesEn, aiAssistantEn, versionEn];

  for (const section of sectionBundles) {
    if (section && typeof section === 'object') {
      messages = deepMerge(messages, section);
    }
  }

  return {
    locale,
    messages,
    onError(error) {
      try {
        // Silence missing message warnings; we provide fallbacks at runtime
        // @ts-ignore next-intl error shape
        if (error?.code === 'MISSING_MESSAGE') return;
      } catch {}
      // eslint-disable-next-line no-console
      console.error(error);
    }
  };
});
