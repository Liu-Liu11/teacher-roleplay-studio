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
  // 老师"已经有场景"之后还能主动回看 landing / 说明页。
  // 没这个开关的话，一建场景 landing 就永远消失，新老师再想看一下平台是干嘛的就没路径。
  const [showAbout, setShowAbout] = useState(false);
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
        // 起码得是一个对象，而且能看出是场景（有 title 或 agents 或 learningObjectives 之一）
        if (!data || typeof data !== 'object') throw new Error('not an object');
        const looksLikeScenario =
          'title' in data ||
          'agents' in data ||
          'learningObjectives' in data ||
          'studentRole' in data;
        if (!looksLikeScenario) throw new Error('not a scenario');

        // 剥掉导出时自带的 id/时间戳/版本号等——否则 ...seed 会盖掉 emptyScenario 给的新 id，
        // 再导入一次相同的文件就会覆盖前一次导入的场景，看起来像"import 没反应"。
        const {
          id: _oldId,
          createdAt: _c,
          updatedAt: _u,
          ...seed
        } = data;

        const newId = createScenario(seed);
        router.push(`/design/${newId}`);
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
            <Button
              variant="secondary"
              onClick={() => setShowAbout((v) => !v)}
              aria-pressed={showAbout}
            >
              {t('about_button')}
            </Button>
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
        ) : list.length === 0 || showAbout ? (
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

  const howSteps = [
    {
      titleKey: 'landing_how_step1_title',
      bodyKey: 'landing_how_step1_body',
      icon: '💬',
    },
    {
      titleKey: 'landing_how_step2_title',
      bodyKey: 'landing_how_step2_body',
      icon: '🧠',
    },
    {
      titleKey: 'landing_how_step3_title',
      bodyKey: 'landing_how_step3_body',
      icon: '🚀',
    },
  ] as const;

  const features = [
    { titleKey: 'landing_feat_npc_title', bodyKey: 'landing_feat_npc_body' },
    { titleKey: 'landing_feat_image_title', bodyKey: 'landing_feat_image_body' },
    {
      titleKey: 'landing_feat_students_title',
      bodyKey: 'landing_feat_students_body',
    },
    { titleKey: 'landing_feat_eval_title', bodyKey: 'landing_feat_eval_body' },
    {
      titleKey: 'landing_feat_export_title',
      bodyKey: 'landing_feat_export_body',
    },
    {
      titleKey: 'landing_feat_bilingual_title',
      bodyKey: 'landing_feat_bilingual_body',
    },
  ] as const;

  const useCases = [
    { icon: '🏥', titleKey: 'uc_nursing', subKey: 'uc_nursing_sub' },
    { icon: '⚖️', titleKey: 'uc_law', subKey: 'uc_law_sub' },
    { icon: '🔬', titleKey: 'uc_forensic', subKey: 'uc_forensic_sub' },
    { icon: '🤝', titleKey: 'uc_social', subKey: 'uc_social_sub' },
    { icon: '💼', titleKey: 'uc_business', subKey: 'uc_business_sub' },
    { icon: '🎓', titleKey: 'uc_any', subKey: 'uc_any_sub' },
  ] as const;

  return (
    <div className="space-y-16">
      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-brand-50 border border-slate-200 rounded-3xl px-6 py-14 md:py-20">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-brand-200/40 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-brand-700 bg-white border border-brand-200 px-3 py-1 rounded-full mb-5">
            <span>🎭</span>
            <span>TeacherRoleplayStudio</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 leading-tight">
            {t('landing_hero_tagline')}
          </h2>
          <p className="mt-5 text-base md:text-lg text-slate-600 leading-relaxed">
            {t('landing_hero_body')}
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" onClick={onCreate}>
              {t('landing_primary_cta')}
            </Button>
            <Button variant="secondary" size="lg" onClick={onImport}>
              {t('landing_secondary_cta')}
            </Button>
          </div>
          <p className="mt-6 text-xs text-slate-400">
            🔒 {t('landing_privacy_note')}
          </p>
        </div>
      </section>

      {/* ── Screenshots ────────────────────────────────────── */}
      <section>
        <h3 className="text-center text-xl md:text-2xl font-semibold text-slate-900 mb-8">
          {t('landing_screenshots_title')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              src: '/hero-design.png',
              captionKey: 'landing_screenshot_design_caption',
            },
            {
              src: '/hero-run.png',
              captionKey: 'landing_screenshot_run_caption',
            },
          ].map((shot) => (
            <figure key={shot.src} className="group">
              <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm group-hover:shadow-md transition-shadow bg-slate-50">
                <img
                  src={shot.src}
                  alt={t(shot.captionKey as any)}
                  loading="lazy"
                  className="w-full h-auto block"
                />
              </div>
              <figcaption className="mt-2 text-xs text-slate-500 text-center">
                {t(shot.captionKey as any)}
              </figcaption>
            </figure>
          ))}
        </div>
      </section>

      {/* ── How it works (3 steps) ─────────────────────────── */}
      <section>
        <h3 className="text-center text-xl md:text-2xl font-semibold text-slate-900 mb-8">
          {t('landing_how_title')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {howSteps.map((s) => (
            <div
              key={s.titleKey}
              className="bg-white border border-slate-200 rounded-2xl p-6 hover:border-brand-400 hover:shadow-md transition-all"
            >
              <div className="text-3xl mb-3">{s.icon}</div>
              <h4 className="font-semibold text-slate-900 mb-2">
                {t(s.titleKey as any)}
              </h4>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t(s.bodyKey as any)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section>
        <h3 className="text-center text-xl md:text-2xl font-semibold text-slate-900 mb-8">
          {t('landing_features_title')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((f) => (
            <div
              key={f.titleKey}
              className="bg-white border border-slate-200 rounded-2xl p-5"
            >
              <div className="font-semibold text-slate-900 mb-1.5">
                {t(f.titleKey as any)}
              </div>
              <p className="text-sm text-slate-600 leading-relaxed">
                {t(f.bodyKey as any)}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Use cases ──────────────────────────────────────── */}
      <section>
        <h3 className="text-center text-xl md:text-2xl font-semibold text-slate-900 mb-8">
          {t('use_cases_title')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {useCases.map((c) => (
            <div
              key={c.titleKey}
              className="bg-slate-50 border border-slate-200 rounded-xl p-4 hover:bg-white hover:border-brand-300 transition-colors"
            >
              <div className="font-medium text-slate-800">
                {c.icon} {t(c.titleKey as any)}
              </div>
              <div className="text-slate-500 text-xs mt-1">
                {t(c.subKey as any)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────── */}
      <section className="text-center bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 text-white rounded-3xl px-6 py-14">
        <h3 className="text-2xl md:text-3xl font-bold mb-3">
          {t('landing_cta_title')}
        </h3>
        <p className="text-indigo-200 mb-7 max-w-xl mx-auto">
          {t('landing_cta_body')}
        </p>
        <Button size="lg" onClick={onCreate}>
          {t('landing_primary_cta')}
        </Button>
      </section>
    </div>
  );
}
