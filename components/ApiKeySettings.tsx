'use client';

import { useEffect, useState } from 'react';
import { useStudio } from '@/lib/store';
import { useT } from '@/lib/useT';

/**
 * 右上角一枚 ⚙ 按钮。点开一个小模态框让用户填自己的 Gemini API key。
 * Key 存在 zustand（persist 到 LocalStorage），不会离开浏览器到第三方服务器。
 */
export function ApiKeySettingsButton() {
  const { t } = useT();
  const userApiKey = useStudio((s) => s.userApiKey);
  const [open, setOpen] = useState(false);

  const hasKey = !!userApiKey;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={`h-9 px-3 rounded-lg border text-sm font-medium transition-colors ${
          hasKey
            ? 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            : 'border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100'
        }`}
        title={hasKey ? t('apikey_status_set', { prefix: userApiKey.slice(0, 4) }) : t('apikey_status_unset')}
      >
        {t('settings')}
      </button>
      {open && <ApiKeyModal onClose={() => setOpen(false)} />}
    </>
  );
}

function ApiKeyModal({ onClose }: { onClose: () => void }) {
  const { t } = useT();
  const userApiKey = useStudio((s) => s.userApiKey);
  const setUserApiKey = useStudio((s) => s.setUserApiKey);

  const [draft, setDraft] = useState(userApiKey);
  const [justSaved, setJustSaved] = useState(false);

  // Esc 关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  function save() {
    setUserApiKey(draft);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  }

  function clear() {
    setDraft('');
    setUserApiKey('');
  }

  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-1">{t('apikey_title')}</h2>
        <p className="text-sm text-slate-600 mb-3">{t('apikey_desc')}</p>

        <p className="text-xs text-slate-500 mb-4">
          {t('apikey_get_hint')}{' '}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand-600 underline"
          >
            {t('apikey_get_link')}
          </a>
          {t('apikey_get_suffix')}
        </p>

        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={t('apikey_input_ph')}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm font-mono mb-3"
          autoFocus
        />

        <p className="text-xs text-slate-500 mb-4 leading-relaxed">
          {t('apikey_privacy')}
        </p>

        <div className="flex items-center justify-between gap-2">
          <button
            onClick={clear}
            disabled={!draft && !userApiKey}
            className="text-xs text-slate-500 hover:text-red-600 disabled:opacity-40"
          >
            {t('apikey_clear')}
          </button>
          <div className="flex items-center gap-2">
            {justSaved && (
              <span className="text-xs text-green-600">{t('apikey_saved')}</span>
            )}
            <button
              onClick={onClose}
              className="text-sm px-3 py-1.5 rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              {t('cancel')}
            </button>
            <button
              onClick={save}
              disabled={!draft}
              className="text-sm px-4 py-1.5 rounded-md bg-brand-600 text-white hover:bg-brand-700 disabled:opacity-40"
            >
              {t('apikey_save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 没填 key 时在页面顶部显示一条提醒。点击打开设置模态框。
 * 已经有 key 就什么都不渲染。
 */
export function ApiKeyMissingBanner() {
  const { t } = useT();
  const userApiKey = useStudio((s) => s.userApiKey);
  const [open, setOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  if (!hydrated || userApiKey) return null;

  return (
    <>
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-sm text-amber-800 text-center">
        {t('apikey_banner_missing')}
        <button
          onClick={() => setOpen(true)}
          className="underline font-medium hover:text-amber-900"
        >
          {t('apikey_banner_cta')}
        </button>
      </div>
      {open && <ApiKeyModal onClose={() => setOpen(false)} />}
    </>
  );
}
