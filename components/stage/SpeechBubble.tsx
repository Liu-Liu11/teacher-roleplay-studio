'use client';

import { motion } from 'motion/react';

interface SpeechBubbleProps {
  speakerName: string;
  content: string;
  side: 'left' | 'right' | 'center';
  accentColor?: string;
  isStudent?: boolean;
  isNarrator?: boolean;
  isNew?: boolean;       // 刚冒出来（触发动画）
  onPlayAudio?: () => void;
  audioState?: 'idle' | 'loading' | 'playing';
}

export function SpeechBubble({
  speakerName,
  content,
  side,
  accentColor = '#2563eb',
  isStudent = false,
  isNarrator = false,
  isNew = false,
  onPlayAudio,
  audioState = 'idle',
}: SpeechBubbleProps) {
  if (isNarrator) {
    return (
      <motion.div
        initial={isNew ? { opacity: 0, y: -6 } : false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex justify-center my-3"
      >
        <div className="inline-block bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2 rounded-full max-w-[80%] text-center shadow-sm">
          <span className="mr-1">📖</span>
          <span className="whitespace-pre-wrap">{content}</span>
        </div>
      </motion.div>
    );
  }

  const justify =
    side === 'right' ? 'justify-end' : side === 'center' ? 'justify-center' : 'justify-start';
  const tailSide = side === 'right' ? 'rounded-br-sm' : 'rounded-bl-sm';
  const bg = isStudent
    ? 'bg-gradient-to-br from-brand-500 to-brand-600 text-white'
    : 'bg-white text-slate-800 border border-slate-200';

  const initial = isNew
    ? {
        opacity: 0,
        y: 10,
        scale: 0.92,
        x: side === 'right' ? 20 : side === 'left' ? -20 : 0,
      }
    : false;

  return (
    <motion.div
      initial={initial}
      animate={{ opacity: 1, y: 0, scale: 1, x: 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      className={`flex ${justify} my-2`}
    >
      <div className={`max-w-[78%] ${side === 'right' ? 'items-end' : 'items-start'} flex flex-col`}>
        <div
          className={`text-[11px] mb-1 px-2 font-medium ${
            isStudent ? 'text-brand-700' : 'text-slate-500'
          } ${side === 'right' ? 'text-right' : ''}`}
          style={!isStudent ? { color: accentColor } : undefined}
        >
          {speakerName}
        </div>
        <div
          className={`relative px-4 py-2.5 rounded-2xl ${tailSide} ${bg} shadow-sm`}
          style={
            !isStudent
              ? { borderLeft: `3px solid ${accentColor}` }
              : undefined
          }
        >
          <div className="prose-msg text-sm leading-relaxed">{content}</div>
          {onPlayAudio && (
            <button
              onClick={onPlayAudio}
              disabled={audioState === 'loading'}
              className={`ml-1 mt-1 inline-flex items-center gap-1 text-[11px] ${
                isStudent ? 'text-white/80 hover:text-white' : 'text-slate-400 hover:text-slate-700'
              } disabled:opacity-50 transition-colors`}
              title="play audio"
            >
              {audioState === 'playing' ? (
                <span className="inline-flex items-center gap-0.5">
                  <span className="inline-block w-[2px] h-2 bg-current animate-pulse" />
                  <span className="inline-block w-[2px] h-3 bg-current animate-pulse" style={{ animationDelay: '0.1s' }} />
                  <span className="inline-block w-[2px] h-2 bg-current animate-pulse" style={{ animationDelay: '0.2s' }} />
                </span>
              ) : audioState === 'loading' ? (
                <span className="inline-block w-3 h-3 border border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <span>▶</span>
              )}
              <span>voice</span>
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
