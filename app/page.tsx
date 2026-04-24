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
          <EmptyState onCreate={handleCreate} onImport={handleImport} />
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

function EmptyState({
  onCreate,
  onImport,
}: {
  onCreate: () => void;
  onImport: () => void;
}) {
  const { t } = useT();

  const steps = [
    { titleKey: 'landing_how_step1_title', bodyKey: 'landing_how_step1_body' },
    { titleKey: 'landing_how_step2_title', bodyKey: 'landing_how_step2_body' },
    { titleKey: 'landing_how_step3_title', bodyKey: 'landing_how_step3_body' },
  ] as const;

  const features = [
    'landing_feat_npc',
    'landing_feat_image',
    'landing_feat_students',
    'landing_feat_eval',
    'landing_feat_export',
    'landing_feat_bilingual',
  ] as const;

  const useCases = [
    'uc_nursing',
    'uc_law',
    'uc_forensic',
    'uc_social',
    'uc_business',
    'uc_any',
  ] as const;

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── Hero ── */}
      <section className="text-center pt-16 pb-20">
        <h2 className="text-4xl md:text-5xl font-semibold tracking-tight text-slate-900 leading-[1.15]">
          {t('landing_hero_tagline')}
        </h2>
        <p className="mt-5 text-lg text-slate-500">
          {t('landing_hero_body')}
        </p>
        <div className="mt-10 flex items-center justify-center gap-3">
          <Button size="lg" onClick={onCreate}>
            {t('landing_primary_cta')}
          </Button>
          <Button variant="secondary" size="lg" onClick={onImport}>
            {t('landing_secondary_cta')}
          </Button>
        </div>
      </section>

      {/* ── 3 steps, single row, plain text ── */}
      <section className="grid grid-cols-3 gap-8 pb-20 border-b border-slate-100">
        {steps.map((s, i) => (
          <div key={s.titleKey} className="text-center">
            <div className="text-xs font-semibold text-slate-400 tracking-widest mb-2">
              0{i + 1}
            </div>
            <div className="font-medium text-slate-900">
              {t(s.titleKey as any)}
            </div>
            <div className="text-sm text-slate-500 mt-1">
              {t(s.bodyKey as any)}
            </div>
          </div>
        ))}
      </section>

      {/* ── Feature pills ── */}
      <section className="py-12 flex flex-wrap justify-center gap-2">
        {features.map((k) => (
          <span
            key={k}
            className="text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full"
          >
            {t(k as any)}
          </span>
        ))}
      </section>

      {/* ── Use-case pills ── */}
      <section className="pb-16 flex flex-wrap justify-center gap-2">
        {useCases.map((k) => (
          <span
            key={k}
            className="text-xs text-slate-500 border border-slate-200 px-2.5 py-1 rounded-full"
          >
            {t(k as any)}
          </span>
        ))}
      </section>

      <p className="text-center text-xs text-slate-400 pb-8">
        {t('landing_privacy_note')}
      </p>
    </div>
  );
}
