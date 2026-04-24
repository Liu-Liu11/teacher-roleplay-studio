'use client';

import { useEffect, useMemo, useState } from 'react';
import { useStudio } from '@/lib/store';
import { useT } from '@/lib/useT';
import { buildPortableScenarioPrompt, buildPortableEvaluationPrompt } from '@/lib/prompts';
import type { Scenario } from '@/lib/types';

type Kind = 'scenario' | 'evaluation';

interface Props {
  scenario: Scenario;
  onClose: () => void;
}

/**
 * 导出弹窗 —— 同时展示两份可直接用的 .txt prompt：
 *   1) 场景 prompt：贴到任何 LLM 就能跑这个多角色场景
 *   2) 评估 prompt：贴转录 + 这份 prompt 就能让任何 LLM 按 rubric 给学生评分
 *
 * 每份都支持：预览 / 下载 .txt / 复制到剪贴板 / 保存到 Prompt 库
 */
export function ExportPromptsModal({ scenario, onClose }: Props) {
  const { t, locale } = useT();
  const saveToLibrary = useStudio((s) => s.saveToLibrary);

  // Esc 关闭弹窗 —— 标准桌面交互习惯
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const scenarioPrompt = useMemo(
    () => buildPortableScenarioPrompt(scenario, locale),
    [scenario, locale]
  );
  const evalPrompt = useMemo(
    () => buildPortableEvaluationPrompt(scenario, locale),
    [scenario, locale]
  );

  const [tab, setTab] = useState<Kind>('scenario');
  const [copied, setCopied] = useState<Kind | null>(null);
  const [saved, setSaved] = useState<Kind | null>(null);

  function filenameFor(kind: Kind) {
    const safe = (scenario.title || 'scenario').replace(/[\\/:*?"<>|]+/g, '_').trim();
    return kind === 'scenario'
      ? `${safe}__scenario_prompt.txt`
      : `${safe}__evaluation_prompt.txt`;
  }

  function download(kind: Kind) {
    const content = kind === 'scenario' ? scenarioPrompt : evalPrompt;
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filenameFor(kind);
    a.click();
    URL.revokeObjectURL(url);
  }

  /**
   * 下载 .json —— 整个场景的完整数据包，可以用首页"导入场景"按钮重新载入。
   * 用途：跨设备迁移、分享给同事、备份。
   *
   * 这里去掉 sceneImage 和 agents[*].avatarImage（生成的 base64 图很大，再生即可），
   * 以及 pedagogyChat（那是老师和教学法专家的私下对话历史，分享时不需要）。
   * 核心结构字段全部保留——包括 agents / rubric / traps / customSections 等。
   */
  function downloadJson() {
    const safe = (scenario.title || 'scenario')
      .replace(/[\\/:*?"<>|]+/g, '_')
      .trim();
    const { sceneImage: _si, pedagogyChat: _pc, agents, ...rest } = scenario as any;
    const payload = {
      ...rest,
      pedagogyChat: [],
      agents: (agents || []).map((a: any) => {
        const { avatarImage: _ai, ...agentRest } = a || {};
        return agentRest;
      }),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safe || 'scenario'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copy(kind: Kind) {
    const content = kind === 'scenario' ? scenarioPrompt : evalPrompt;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  function save(kind: Kind) {
    const content = kind === 'scenario' ? scenarioPrompt : evalPrompt;
    saveToLibrary({
      scenarioId: scenario.id,
      scenarioTitle: scenario.title || 'untitled',
      scenarioVersion: scenario.version,
      kind,
      name: `${scenario.title || 'untitled'} · ${
        kind === 'scenario' ? t('library_type_scenario') : t('library_type_evaluation')
      } · v${scenario.version}`,
      content,
    });
    setSaved(kind);
    setTimeout(() => setSaved(null), 1500);
  }

  const preview = tab === 'scenario' ? scenarioPrompt : evalPrompt;

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <header className="px-6 py-4 border-b border-slate-200 flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-lg">{t('export_modal_title')}</h2>
            <p className="text-xs text-slate-500 mt-1">{t('export_modal_sub')}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
            aria-label="close"
          >
            ✕
          </button>
        </header>

        <div className="flex gap-1 px-6 pt-3">
          {(['scenario', 'evaluation'] as Kind[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-3 py-1.5 rounded-t-lg text-sm font-medium transition-colors ${
                tab === k
                  ? 'bg-slate-100 text-slate-900 border-x border-t border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {k === 'scenario' ? t('export_kind_scenario') : t('export_kind_evaluation')}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden flex flex-col bg-slate-50 border-t border-slate-200">
          <div className="flex-1 overflow-auto px-6 py-4">
            <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap bg-white border border-slate-200 rounded-lg p-4">
              {preview}
            </pre>
          </div>

          <div className="px-6 py-3 border-t border-slate-200 bg-white flex flex-wrap items-center gap-2 justify-end">
            <button
              onClick={() => copy(tab)}
              className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              {copied === tab ? t('export_copied') : t('export_copy')}
            </button>
            <button
              onClick={() => download(tab)}
              className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
            >
              {t('export_download_txt')}
            </button>
            <button
              onClick={downloadJson}
              className="text-sm px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700"
              title={t('export_download_json')}
            >
              {t('export_download_json')}
            </button>
            <button
              onClick={() => save(tab)}
              className="text-sm px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-700 text-white"
            >
              {saved === tab ? t('export_saved_library') : t('export_save_library')}
            </button>
            <button
              onClick={onClose}
              className="text-sm px-3 py-1.5 rounded-lg text-slate-600 hover:text-slate-900"
            >
              {t('export_close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
