'use client';

import { useStudio } from '@/lib/store';
import type { Locale } from '@/lib/i18n';

/**
 * 顶部右侧的语言切换按钮 —— 在中文/英文之间切换
 * 所有 UI 文字 + LLM 输出都会跟随这里的 locale
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useStudio((s) => s.locale);
  const setLocale = useStudio((s) => s.setLocale);

  const buttons: Array<{ code: Locale; label: string }> = [
    { code: 'zh', label: '中文' },
    { code: 'en', label: 'EN' },
  ];

  return (
    <div
      className={
        'inline-flex h-9 items-center rounded-lg border border-slate-300 bg-white p-0.5 text-sm shadow-sm ' +
        (className || '')
      }
      role="group"
      aria-label="Language switcher"
    >
      {buttons.map((b) => {
        const active = locale === b.code;
        return (
          <button
            key={b.code}
            type="button"
            onClick={() => setLocale(b.code)}
            className={
              'h-full px-3 rounded-md transition text-sm font-medium ' +
              (active
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:text-slate-900')
            }
            aria-pressed={active}
          >
            {b.label}
          </button>
        );
      })}
    </div>
  );
}
