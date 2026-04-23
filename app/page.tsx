'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useStudio } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/Button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ApiKeySettingsButton, ApiKeyMissingBanner } from '@/components/ApiKeySettings';
import { PromptLibraryModal } from '@/components/PromptLibraryModal';
import { useT } from '@/lib/useT';

export default function HomePage() {
  const router = useRouter();
  const scenarios = useStudio((s) => s.scenarios);
  const createScenario = useStudio((s) => s.createScenario);
  const deleteScenario = useStudio((s) => s.deleteScenario);
  const { t } = useT();

  const [hydrated, setHydrated] = useState(false);
  const [showLibrary, setShowLibrary] = useState(false);
  const libraryCount = useStudio((s) => s.promptLibrary.length);
  useEffect(() => setHydrated(true), []);

  const list = hydrated
    ? Object.values(scenarios).sort((a, b) => b.updatedAt - a.updatedAt)
    : [];

  const handleCreate = () => {
    const id = createScenario();
    router.push(`/design/${id}`);
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const id = createScenario(data);
        router.push(`/design/${id}`);
      } catch (err) {
        alert(t('import_failed'));
      }
    };
    input.click();
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <ApiKeyMissingBanner />
      {/* Header */}
      <header className="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 text-white shadow-lg">
        <div className="max-w-6xl mx-auto px-6 py-8 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t('home_title')}
            </h1>
            <p className="text-sm text-indigo-200 mt-1.5">{t('home_subtitle')}</p>
          </div>
          <div className="flex gap-2 items-center">
            <LanguageSwitcher />
            <ApiKeySettingsButton />
            <Button variant="secondary" onClick={() => setShowLibrary(true)}>
              {t('library_button')}
              {hydrated && libraryCount > 0 && (
                <span className="ml-1.5 text-[10px] bg-white/20 rounded-full px-1.5 py-0.5">
                  {libraryCount}
                </span>
              )}
            </Button>
            <Button variant="secondary" onClick={handleImport}>
              {t('import_scenario')}
            </Button>
            <Button onClick={handleCreate}>{t('new_scenario')}</Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        {!hydrated ? (
          <div className="text-center text-slate-400 py-24">{t('loading')}</div>
        ) : list.length === 0 ? (
          <EmptyState onCreate={handleCreate} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {list.map((s) => (
              <Link key={s.id} href={`/design/${s.id}`} className="group">
                <div
                  className="relative bg-white border border-slate-200 rounded-2xl p-5 h-full hover:border-brand-400 hover:shadow-xl hover:-translate-y-0.5 transition-all overflow-hidden"
                >
                  {s.sceneImage && (
                    <div
                      className="absolute inset-0 opacity-[0.08] group-hover:opacity-20 transition-opacity"
                      style={{
                        backgroundImage: `url(${s.sceneImage})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                      }}
                    />
                  )}
                  <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-[10px] font-semibold text-brand-600 uppercase tracking-wider bg-brand-50 px-2 py-0.5 rounded-full">
                      {s.discipline || t('uncategorized')}
                    </div>
                    <div className="text-xs text-slate-400">v{s.version}</div>
                  </div>
                  <h3 className="font-semibold text-slate-900 mb-2 line-clamp-2 group-hover:text-brand-600 text-lg">
                    {s.title || t('unnamed')}
                  </h3>
                  <p className="text-sm text-slate-600 line-clamp-3 mb-4 min-h-[3.75rem]">
                    {s.context || '—'}
                  </p>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>{t('stat_agents', { n: s.agents.length })}</span>
                    <span>{t('stat_goals', { n: s.learningObjectives.length })}</span>
                    <span>{t('stat_traps', { n: s.pedagogicalTraps.length })}</span>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-400">
                      {t('updated_at', { time: formatDate(s.updatedAt) })}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        if (confirm(t('confirm_delete', { name: s.title })))
                          deleteScenario(s.id);
                      }}
                      className="text-xs text-red-500 hover:text-red-700"
                    >
                      {t('delete')}
                    </button>
                  </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <footer className="text-center py-10 text-xs text-slate-400">
        {t('footer_note')}
      </footer>

      {showLibrary && <PromptLibraryModal onClose={() => setShowLibrary(false)} />}
    </main>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  const { t } = useT();
  return (
    <div className="text-center py-24 bg-white border-2 border-dashed border-slate-300 rounded-2xl">
      <div className="text-6xl mb-4">🎓</div>
      <h2 className="text-xl font-semibold text-slate-800 mb-2">
        {t('empty_title')}
      </h2>
      <p className="text-slate-500 max-w-md mx-auto mb-6">{t('empty_subtitle')}</p>
      <Button size="lg" onClick={onCreate}>
        {t('create_first')}
      </Button>

      <div className="mt-12 text-left max-w-2xl mx-auto">
        <h3 className="text-sm font-semibold text-slate-700 mb-3">
          {t('use_cases_title')}
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { icon: '🏥', titleKey: 'uc_nursing', subKey: 'uc_nursing_sub' },
            { icon: '⚖️', titleKey: 'uc_law', subKey: 'uc_law_sub' },
            { icon: '🔬', titleKey: 'uc_forensic', subKey: 'uc_forensic_sub' },
            { icon: '🤝', titleKey: 'uc_social', subKey: 'uc_social_sub' },
            { icon: '💼', titleKey: 'uc_business', subKey: 'uc_business_sub' },
            { icon: '🎓', titleKey: 'uc_any', subKey: 'uc_any_sub' },
          ].map((c) => (
            <div key={c.titleKey} className="bg-slate-50 rounded-lg p-3">
              <div className="font-medium text-slate-800">
                {c.icon} {t(c.titleKey as any)}
              </div>
              <div className="text-slate-500 text-xs mt-0.5">
                {t(c.subKey as any)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
