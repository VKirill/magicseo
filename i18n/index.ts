import { useEffect, useState } from 'react';
import { en, ru } from './hierarchy.ts';

export { en, ru } from './hierarchy.ts';

export type Locale = 'en' | 'ru';

/** English is the default; Russian when document.documentElement.lang starts with 'ru'. */
export function detectLocale(): Locale {
  if (typeof document === 'undefined') return 'en';
  return document.documentElement.lang.toLowerCase().startsWith('ru') ? 'ru' : 'en';
}

export function strings(): typeof en {
  return detectLocale() === 'ru' ? ru : en;
}

export function useStrings(): typeof en {
  const [value, setValue] = useState(strings);
  useEffect(() => {
    const sync = () => setValue(strings());
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    return () => observer.disconnect();
  }, []);
  return value;
}

export function errorText(error: unknown, t: typeof en): string {
  const raw = error instanceof Error ? error.message : String(error);
  if (/fetch|network|timeout|abort/i.test(raw)) return t.networkError;
  return `${t.error}: ${raw}`;
}
