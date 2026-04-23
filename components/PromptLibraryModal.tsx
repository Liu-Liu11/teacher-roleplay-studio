'use client';

import { useState } from 'react';
import { useStudio } from '@/lib/store';
import { useT } from '@/lib/useT';
import { formatDate } from '@/lib/utils';
import type { PromptLibraryEntry } from '@/lib/types';

interface Props {
  onClose: () => void;
}

type Filter = 'all' | 'scenario' | 'evaluation';

export function PromptLibraryModal({ onClose }: Props) {
  const { t } = useT();
  const library = useStudio((s) => s.promptLibrary);
  const deleteEntry = useStudio((s) => s.deleteLibraryEntry);
  const renameEntry = useStudio((s) => s.renameLibraryEntry);

  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState<string | null>(library[0]?.id ?? null);
  const [editingName, setEditingName] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const visible = library.filter((e) => filter === 'all' || e.kind === filter);
  const selected = library.find((e) => e.id === selectedId);

  async function copy(e: PromptLibraryEntry) {
    try {
      await navigator.clipboard.writeText(e.content);
      setCopied(e.id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      /* ignore */
    }
  }

  function download(e: PromptLibraryEntry) {
    const safe = (e.name || 'prompt').replace(/[\\/:*?"<>|]+/g, '_').trim();
    const blob = new Blob([e.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safe}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
        <header className="px-6 py-4 border-b border-slate-200 flex items-start justify-between">
          <div>
            <h2 className="font-semibold text-lg">{t('library_title')}</h2>
            <p className="text-xs text-slate-500 mt-1">{t('library_subtitle')}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 text-xl leading-none"
          >
            ✕
          </button>
        </header>

        <div className="flex gap-2 px-6 py-2 border-b border-slate-200 bg-slate-50">
          {(['all', 'scenario', 'evaluation'] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-3 py-1 rounded-full transition-colors ${
                filter === f
                  ? 'bg-brand-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              {f === 'all'
                ? t('library_filter_all')
                : f === 'scenario'
                ? t('library_filter_scenario')
                : t('library_filter_evaluation')}{' '}
              ({library.filter((e) => f === 'all' || e.kind === f).length})
            </button>
          ))}
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* list */}
          <div className="w-[38%] border-r border-slate-200 overflow-y-auto">
            {visible.length === 0 ? (
              <div className="p-8 text-sm text-slate-400 text-center">
                {t('library_empty')}
              </div>
            ) : (
              visible.map((e) => (
                <button
                  key={e.id}
                  onClick={() => setSelectedId(e.id)}
                  className={`w-full text-left px-4 py-3 border-b border-slate-100 transition-colors ${
                    selectedId === e.id ? 'bg-brand-50 border-l-4 border-l-brand-500' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                      {e.kind === 'scenario'
                        ? t('library_type_scenario')
                        : t('library_type_evaluation')}
                    </span>
                  </div>
                  <div className="font-medium text-sm line-clamp-2">{e.name}</div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {t('library_from_scenario', {
                      title: e.scenarioTitle,
                      v: e.scenarioVersion,
                    })}
                  </div>
                  <div className="text-[11px] text-slate-400">
                    {t('library_saved_at', { time: formatDate(e.savedAt) })}
                  </div>
                </button>
              ))
            )}
          </div>

          {/* detail */}
          <div className="flex-1 flex flex-col bg-slate-50 overflow-hidden">
            {selected ? (
              <>
                <div className="px-5 py-3 border-b border-slate-200 bg-white flex items-center gap-2">
                  {editingName === selected.id ? (
                    <input
                      autoFocus
                      defaultValue={selected.name}
                      onBlur={(ev) => {
                        renameEntry(selected.id, ev.target.value.trim() || selected.name);
                        setEditingName(null);
                      }}
                      onKeyDown={(ev) => {
                        if (ev.key === 'Enter') {
                          renameEntry(
                            selected.id,
                            (ev.target as HTMLInputElement).value.trim() || selected.name
                          );
                          setEditingName(null);
                        }
                      }}
                      className="flex-1 text-sm font-medium border border-slate-300 rounded px-2 py-1"
                    />
                  ) : (
                    <h3
                      className="flex-1 text-sm font-medium cursor-text"
                      onClick={() => setEditingName(selected.id)}
                      title={t('library_rename_ph')}
                    >
                      {selected.name}
                    </h3>
                  )}
                  <button
                    onClick={() => copy(selected)}
                    className="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    {copied === selected.id ? t('export_copied') : t('export_copy')}
                  </button>
                  <button
                    onClick={() => download(selected)}
                    className="text-xs px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700"
                  >
                    {t('export_download_txt')}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(t('library_confirm_delete', { name: selected.name }))) {
                        deleteEntry(selected.id);
                        setSelectedId(null);
                      }
                    }}
                    className="text-xs px-2.5 py-1 rounded bg-red-50 hover:bg-red-100 text-red-600"
                  >
                    {t('delete')}
                  </button>
                </div>
                <div className="flex-1 overflow-auto p-5">
                  <pre className="text-xs font-mono text-slate-800 whitespace-pre-wrap bg-white border border-slate-200 rounded-lg p-4">
                    {selected.content}
                  </pre>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-slate-400">
                —
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
