import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export default getRequestConfig(async () => {
  const cookieStore = cookies();
  const locale = cookieStore.get('locale')?.value || 'en';

  const base = (await import(`../messages/${locale}.json`)).default as Record<string, any>;

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
    try {
      // Fallback to English for any missing keys, then apply ES overrides
      const en = (await import('../messages/en.json')).default as Record<string, any>;
      const merged = deepMerge({ ...en }, base);
      try {
        const overrides = (await import('../messages/es-overrides.json')).default as Record<string, any>;
        messages = deepMerge(merged, overrides);
      } catch (_e) {
        messages = merged;
      }
    } catch (_e) {
      // If something fails, keep base
      messages = base;
    }
  } else if (locale === 'en') {
    try {
      const overrides = (await import('../messages/en-overrides.json')).default as Record<string, any>;
      messages = deepMerge({ ...base }, overrides);
    } catch (_e) {
      // no overrides for en
    }
  }

  return {
    locale,
    messages
  };
});
