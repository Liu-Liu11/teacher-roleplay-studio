'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Agent, Message, Scenario } from '@/lib/types';
import { Avatar } from './Avatar';
import { SpeechBubble } from './SpeechBubble';

// 给 NPC 分配相对稳定的彩色 accent
const ACCENTS = [
  '#2563eb', '#db2777', '#7c3aed', '#059669',
  '#d97706', '#0891b2', '#dc2626', '#4f46e5',
];
function accentFor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

interface StageProps {
  scenario: Scenario;
  transcript: Message[];
  currentSpeakerId?: string | null;       // 谁正在说话（用于高亮）
  thinking?: boolean;                     // AI 思考中
  studentName?: string;
  studentEmoji?: string;
  audioEnabled?: boolean;
  onPlayAudio?: (msg: Message) => void;
  audioStateOf?: (msgId: string) => 'idle' | 'loading' | 'playing';
  banner?: React.ReactNode;               // 舞台顶部横幅（结束/场景信息）
  footer?: React.ReactNode;               // 输入框等
}

export function Stage({
  scenario,
  transcript,
  currentSpeakerId,
  thinking = false,
  studentName = 'You',
  studentEmoji = '🧑‍🎓',
  audioEnabled = false,
  onPlayAudio,
  audioStateOf,
  banner,
  footer,
}: StageProps) {
  const transcriptRef = useRef<HTMLDivElement>(null);
  const [newestId, setNewestId] = useState<string | null>(null);

  useEffect(() => {
    const last = transcript[transcript.length - 1];
    if (last) setNewestId(last.id);
    transcriptRef.current?.scrollTo({
      top: transcriptRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [transcript.length]);

  // 最近说话的 agent（让 avatar 继续亮一会儿，视觉稳定）
  const lastAgentSpeakerId = [...transcript]
    .reverse()
    .find((m) => m.speakerId !== 'student' && m.speakerId !== 'narrator')?.speakerId;

  const activeNpcId = currentSpeakerId && currentSpeakerId !== 'student' && currentSpeakerId !== 'narrator'
    ? currentSpeakerId
    : lastAgentSpeakerId;

  const studentSpeaking = currentSpeakerId === 'student';

  return (
    <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-inner bg-slate-900">
      {/* 背景图层 */}
      <div
        className="absolute inset-0"
        style={
          scenario.sceneImage
            ? {
                backgroundImage: `url(${scenario.sceneImage})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }
            : {
                background:
                  'linear-gradient(135deg, #1e293b 0%, #334155 45%, #1e3a8a 100%)',
              }
        }
      />
      {/* 柔化遮罩 */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900/55 via-slate-900/30 to-slate-900/85" />

      {/* 主体 */}
      <div className="relative min-h-[560px] flex flex-col">
        {banner && <div className="px-4 pt-3">{banner}</div>}

        {/* NPC avatar row */}
        <div className="pt-6 px-6 pb-3">
          <div className="flex flex-wrap items-start justify-center gap-6">
            {scenario.agents.map((a: Agent) => {
              const accent = accentFor(a.id);
              const speaking = activeNpcId === a.id;
              return (
                <Avatar
                  key={a.id}
                  name={a.name}
                  role={a.role}
                  emoji={a.avatar}
                  image={a.avatarImage}
                  accentColor={accent}
                  speaking={speaking}
                  dimmed={!speaking && !!activeNpcId}
                  size="md"
                />
              );
            })}
          </div>
        </div>

        {/* 对话流 */}
        <div
          ref={transcriptRef}
          className="flex-1 overflow-y-auto scrollbar-thin px-4 py-4 space-y-0"
        >
          {transcript.length === 0 && (
            <div className="h-full flex items-center justify-center text-slate-300/80 text-sm">
              {/* 空态由外部 banner 负责描述 */}
            </div>
          )}
          <AnimatePresence initial={false}>
            {transcript.map((m) => {
              const isStudent = m.speakerId === 'student';
              const isNarrator = m.speakerId === 'narrator';
              const agent = scenario.agents.find((a) => a.id === m.speakerId);
              const accent = agent ? accentFor(agent.id) : '#64748b';
              return (
                <SpeechBubble
                  key={m.id}
                  speakerName={m.speakerName}
                  content={m.content}
                  side={isStudent ? 'right' : isNarrator ? 'center' : 'left'}
                  accentColor={accent}
                  isStudent={isStudent}
                  isNarrator={isNarrator}
                  isNew={m.id === newestId}
                  onPlayAudio={
                    audioEnabled && !isNarrator && onPlayAudio
                      ? () => onPlayAudio(m)
                      : undefined
                  }
                  audioState={audioStateOf ? audioStateOf(m.id) : 'idle'}
                />
              );
            })}
          </AnimatePresence>

          {thinking && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-slate-200 text-xs pl-2 mt-2"
            >
              <ThinkingDots />
              <span className="italic opacity-80">...</span>
            </motion.div>
          )}
        </div>

        {/* Student row */}
        <div className="px-6 pb-5 pt-2 border-t border-white/10 bg-gradient-to-b from-transparent to-black/30">
          <div className="flex items-center gap-4">
            <Avatar
              name={studentName}
              emoji={studentEmoji}
              accentColor="#22d3ee"
              speaking={studentSpeaking}
              size="sm"
            />
            <div className="flex-1">{footer}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ThinkingDots() {
  return (
    <span className="inline-flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-1.5 h-1.5 rounded-full bg-white/80"
          animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
        />
      ))}
    </span>
  );
}

export { accentFor };
