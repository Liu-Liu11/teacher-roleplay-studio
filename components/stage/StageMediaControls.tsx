'use client';

import { useT } from '@/lib/useT';

type PrepStage = 'idle' | 'scene' | 'avatars' | 'done' | 'error';

interface Props {
  ttsEnabled: boolean;
  onToggleTts: () => void;
  prepStage?: PrepStage;
  prepCurrent?: string;
  prepDone?: number;
  prepTotal?: number;
  prepError?: string;
  onRetry?: () => void;
}

/**
 * 舞台右上角的控制条：
 * - 自动生成状态（scene/avatars 进度）
 * - 错误信息 + 重试按钮（有一个图没画出来时特别重要）
 * - TTS 开关
 */
export function StageMediaControls({
  ttsEnabled,
  onToggleTts,
  prepStage = 'idle',
  prepCurrent,
  prepDone = 0,
  prepTotal = 0,
  prepError,
  onRetry,
}: Props) {
  const { t } = useT();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* 进度指示器（中途，包括 error 状态下仍在跑剩余任务） */}
      {(prepStage === 'scene' || prepStage === 'avatars') && (
        <span className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/20 text-white">
          <span className="inline-block w-3 h-3 border-2 border-white/70 border-t-transparent rounded-full animate-spin" />
          {prepStage === 'scene'
            ? t('stage_generating_scene')
            : t('stage_generating_avatars')}
          {prepTotal > 0 && (
            <span className="opacity-70">
              {prepDone}/{prepTotal}
            </span>
          )}
          {prepCurrent && prepStage === 'avatars' && (
            <span className="opacity-70 truncate max-w-[160px]">· {prepCurrent}</span>
          )}
        </span>
      )}

      {/* 错误信息 + 重试 */}
      {prepStage === 'error' && prepError && (
        <span
          className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-amber-500/25 border border-amber-300/50 text-amber-50"
          title={prepError}
        >
          ⚠ <span className="max-w-[220px] truncate">{prepError}</span>
          {onRetry && (
            <button
              onClick={onRetry}
              className="ml-1 px-2 py-0.5 rounded bg-white/20 hover:bg-white/30 text-white text-[11px]"
            >
              {t('stage_retry')}
            </button>
          )}
        </span>
      )}

      {/* TTS 开关 */}
      <button
        onClick={onToggleTts}
        className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
          ttsEnabled
            ? 'bg-emerald-500/30 border-emerald-300/50 text-white'
            : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
        }`}
      >
        {ttsEnabled ? t('stage_tts_on') : t('stage_tts_off')}
      </button>
    </div>
  );
}
