'use client';

import { useEffect, useRef, useState } from 'react';
import { useStudio } from '@/lib/store';
import { useT } from '@/lib/useT';
import type { Evaluation, RefinementResponse, Scenario } from '@/lib/types';

interface Props {
  scenario: Scenario;
  /** 一次或多次评估都支持——来自 Live 自跑 或 Simulate 批量跑 */
  evaluations: Array<{
    runnerName: string;
    runnerType: 'human_student' | 'simulated_student';
    evaluation: Evaluation;
  }>;
  /** 应用完 patch 之后要做的事（如重新跑场景） */
  onApplied?: (newVersion: number) => void;
}

/** 60s 之后如果还没回来就当它挂了 */
const REFINE_TIMEOUT_MS = 90_000;

/**
 * 评估 → 场景升级 的闭环按钮。
 *
 * 反馈策略（和老版本的根本区别）：
 * - 请求期间：按钮上显示"已耗时 Ns"，让老师知道真的在跑，不是挂了
 * - 90 秒超时：AbortController 主动断掉，弹明确的"超时"错误
 * - LLM 返回空 patch（没有实际改动）：弹"本次没提出改动"专用提示，而不是一个空 modal
 * - Apply 之后：从 store 里读真实新版本号（而不是 scenario.version + 1 瞎猜）
 * - Apply 之后：显示一个持久的横幅，写清楚"真正改了哪些字段"，老师能明确看到
 */
export function RefineScenarioButton({ scenario, evaluations, onApplied }: Props) {
  const { t, locale } = useT();
  const userApiKey = useStudio((s) => s.userApiKey);
  const updateScenario = useStudio((s) => s.updateScenario);

  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [proposal, setProposal] = useState<RefinementResponse | null>(null);
  const [noChanges, setNoChanges] = useState(false);
  /** Apply 之后的真实结果反馈：{version, changedFields} */
  const [applied, setApplied] = useState<{
    version: number;
    changedFields: string[];
    /** 老版本号，用于判断真的有没有 +1 */
    prevVersion: number;
  } | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const tickerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 按 Esc 关掉当前弹出的 modal（优先级：proposal > noChanges）。
  // 老师习惯 Esc 退出对话框，没有这个就必须精准点到小 ✕ 按钮，体验很糟。
  useEffect(() => {
    if (!proposal && !noChanges) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (proposal) setProposal(null);
      else if (noChanges) setNoChanges(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [proposal, noChanges]);

  // loading 期间跑一个秒表
  useEffect(() => {
    if (loading) {
      setElapsed(0);
      const startedAt = Date.now();
      tickerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startedAt) / 1000));
      }, 500);
    } else {
      if (tickerRef.current) {
        clearInterval(tickerRef.current);
        tickerRef.current = null;
      }
    }
    return () => {
      if (tickerRef.current) clearInterval(tickerRef.current);
    };
  }, [loading]);

  const label =
    evaluations.length > 1
      ? t('refine_cta_multi', { n: evaluations.length })
      : t('refine_cta');

  async function requestRefinement() {
    if (!userApiKey) {
      alert(t('apikey_missing_error'));
      return;
    }
    // 防重入：loading 中 / modal 已经开着 / noChanges 提示开着 —— 都直接忽略新点击。
    // 同时：如果之前还有个 AbortController 残留（理论上 finally 会清空，但保险起见），先打断它。
    if (loading || proposal || noChanges) return;
    if (abortRef.current) {
      try { abortRef.current.abort(); } catch {}
      abortRef.current = null;
    }
    setLoading(true);
    setApplied(null);
    setNoChanges(false);

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), REFINE_TIMEOUT_MS);

    try {
      const res = await fetch('/api/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario, evaluations, locale, apiKey: userApiKey }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const resp = data as RefinementResponse;
      // 判断：LLM 是否真的提了改动？
      const patchFields = Object.keys(resp.scenarioPatch || {});
      const hasChanges =
        patchFields.length > 0 ||
        (resp.bulletChanges && resp.bulletChanges.length > 0);

      if (!hasChanges) {
        setNoChanges(true);
      } else {
        setProposal(resp);
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        alert(t('refine_timeout'));
      } else {
        alert(t('refine_failed', { msg: err?.message || '' }));
      }
    } finally {
      clearTimeout(timeoutId);
      abortRef.current = null;
      setLoading(false);
    }
  }

  function apply() {
    if (!proposal) return;
    const prevVersion = scenario.version;
    const changedFields = Object.keys(proposal.scenarioPatch || {});
    updateScenario(scenario.id, proposal.scenarioPatch || {});

    // ⚠️ 关键：从 store 读真实的新版本号，而不是靠 scenario.version + 1 猜。
    // updateScenario 只在检测到 structural 字段时才 +1——如果 patch 里只有
    // title/reviewStrategy 这种非 structural 字段，版本号不会变，老师看到
    // "v3→v3" 会以为没生效，我们要显式告诉他。
    const fresh = useStudio.getState().scenarios[scenario.id];
    const realNewVersion = fresh?.version ?? prevVersion;

    setApplied({
      version: realNewVersion,
      changedFields,
      prevVersion,
    });
    setProposal(null);
    onApplied?.(realNewVersion);
  }

  const runningLabel =
    elapsed > 0 ? `${t('refine_running')} · ${t('refine_elapsed', { s: elapsed })}` : t('refine_running');

  return (
    <>
      <button
        onClick={requestRefinement}
        // 不仅 loading 要 disable——弹出 modal 时再点一次会发第二个请求把第一次的 proposal 覆盖掉
        disabled={loading || proposal !== null || noChanges}
        className={`text-sm px-4 py-2 rounded-xl border-2 border-dashed transition-colors ${
          loading
            ? 'border-slate-300 text-slate-400 cursor-wait'
            : proposal || noChanges
              ? 'border-slate-200 text-slate-400 cursor-not-allowed'
              : 'border-brand-400 text-brand-700 hover:bg-brand-50'
        }`}
      >
        {loading ? runningLabel : label}
      </button>

      {/* Apply 后的持久横幅——老师能一眼看到真的改了还是没改 */}
      {applied !== null && (
        <AppliedBanner
          applied={applied}
          onClose={() => setApplied(null)}
        />
      )}

      {/* LLM 返回但没有实际改动 → 专用提示 modal */}
      {noChanges && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="font-semibold text-lg text-amber-700">
              {t('refine_no_changes_title')}
            </h2>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {t('refine_no_changes_body')}
            </p>
            <div className="flex justify-end">
              <button
                onClick={() => setNoChanges(false)}
                className="text-sm px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-900 text-white"
              >
                {t('refine_no_changes_ok')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 正常 proposal modal */}
      {proposal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <header className="px-6 py-4 border-b border-slate-200 flex items-start justify-between">
              <h2 className="font-semibold text-lg">{t('refine_modal_title')}</h2>
              <button
                onClick={() => setProposal(null)}
                className="text-slate-400 hover:text-slate-700 text-xl leading-none"
              >
                ✕
              </button>
            </header>
            <div className="flex-1 overflow-auto px-6 py-4 space-y-4">
              <section>
                <div className="text-xs font-semibold text-slate-500 mb-1">
                  {t('refine_summary_label')}
                </div>
                <p className="text-sm text-slate-800 whitespace-pre-wrap">
                  {proposal.changeSummary}
                </p>
              </section>

              {/* 即将改动哪些字段——在 apply 之前就让老师知道 */}
              <section>
                <div className="text-xs font-semibold text-slate-500 mb-1">
                  {t('refine_diff_heading')}
                </div>
                {Object.keys(proposal.scenarioPatch || {}).length === 0 ? (
                  <p className="text-xs text-slate-500 italic">
                    {t('refine_diff_none')}
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {Object.keys(proposal.scenarioPatch || {}).map((field) => (
                      <span
                        key={field}
                        className="text-xs bg-cyan-50 text-cyan-800 border border-cyan-200 px-2 py-0.5 rounded-full font-mono"
                      >
                        {field}
                      </span>
                    ))}
                  </div>
                )}
              </section>

              <section>
                <div className="text-xs font-semibold text-slate-500 mb-1">
                  {t('refine_changes_label')}
                </div>
                <ul className="space-y-1.5">
                  {(proposal.bulletChanges || []).map((c, i) => (
                    <li
                      key={i}
                      className="text-sm text-slate-700 bg-amber-50 border-l-2 border-amber-400 px-3 py-1.5 rounded"
                    >
                      {c}
                    </li>
                  ))}
                </ul>
              </section>
              <details className="text-xs">
                <summary className="cursor-pointer text-slate-500">
                  raw scenarioPatch (debug)
                </summary>
                <pre className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded text-xs overflow-auto">
                  {JSON.stringify(proposal.scenarioPatch, null, 2)}
                </pre>
              </details>
            </div>
            <footer className="px-6 py-3 border-t border-slate-200 bg-white flex justify-end gap-2">
              <button
                onClick={() => setProposal(null)}
                className="text-sm px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900"
              >
                {t('refine_dismiss')}
              </button>
              <button
                onClick={apply}
                className="text-sm px-4 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white"
              >
                {t('refine_apply')}
              </button>
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

/** 持久的"已应用"反馈条——直到老师点关闭才消失 */
function AppliedBanner({
  applied,
  onClose,
}: {
  applied: { version: number; changedFields: string[]; prevVersion: number };
  onClose: () => void;
}) {
  const { t } = useT();
  const versionBumped = applied.version !== applied.prevVersion;

  return (
    <div
      className={`mt-3 rounded-xl px-4 py-3 border flex items-start justify-between gap-3 ${
        versionBumped
          ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
          : 'bg-amber-50 border-amber-300 text-amber-900'
      }`}
      role="status"
    >
      <div className="flex-1 text-sm">
        <div className="font-semibold">
          {t('refine_applied_banner_title', { v: applied.version })}
        </div>
        <div className="text-xs mt-1">
          {versionBumped
            ? t('refine_applied_banner_fields', {
                list: applied.changedFields.join(', ') || '—',
              })
            : t('refine_applied_banner_nofields', { v: applied.version })}
        </div>
      </div>
      <button
        onClick={onClose}
        className="text-xs px-2 py-1 rounded-md bg-white/60 hover:bg-white border border-current/20 flex-shrink-0"
      >
        {t('refine_applied_banner_close')}
      </button>
    </div>
  );
}
