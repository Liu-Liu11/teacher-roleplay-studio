'use client';

import { useStudio } from './store';
import { t, type TKey } from './i18n';

/**
 * React hook：拿到当前 UI locale + 绑定好 locale 的 t()
 */
export function useT() {
  const locale = useStudio((s) => s.locale);
  return {
    locale,
    t: (key: TKey, vars?: Record<string, string | number>) =>
      t(locale, key, vars),
  };
}
