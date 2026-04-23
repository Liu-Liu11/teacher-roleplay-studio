'use client';

import { useEffect, useRef } from 'react';
import { useStudio } from '@/lib/store';

const STORAGE_KEY = 'teacher-roleplay-studio';

/**
 * 两件事：
 * 1. 把 `<html lang>` 根据老师选的 locale 同步（SSR 维持 "en"，客户端改成当前语言）——
 *    对屏幕阅读器、浏览器翻译提示、浏览器拼写检查都重要。
 * 2. **首装检测**：如果 localStorage 里还没有 store 的持久化键（= 老师第一次打开），
 *    用 navigator.language 猜一个合理的默认语言（中文机就 zh、英文机就 en），
 *    比"不管是谁都给 zh"强很多。老师显式切过之后，下次来就读持久化值，不再覆盖。
 */
export function LocaleHtmlLang() {
  const locale = useStudio((s) => s.locale);
  const setLocale = useStudio((s) => s.setLocale);
  const didAutoDetectRef = useRef(false);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);

  useEffect(() => {
    if (didAutoDetectRef.current) return;
    if (typeof window === 'undefined') return;
    didAutoDetectRef.current = true;
    try {
      // 已经有持久化过的 store（= 老用户）→ 尊重他们之前的选择，不覆盖
      if (window.localStorage.getItem(STORAGE_KEY)) return;
      const navLang = (navigator.language || '').toLowerCase();
      const detected: 'zh' | 'en' = navLang.startsWith('zh') ? 'zh' : 'en';
      // 只在和当前默认不一致时才调 setLocale（避免无意义的 re-render）
      if (detected !== locale) setLocale(detected);
    } catch {
      // localStorage 可能被禁；静默降级即可
    }
  }, [locale, setLocale]);

  return null;
}
