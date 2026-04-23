'use client';

import { motion } from 'motion/react';

interface AvatarProps {
  name: string;
  emoji?: string;        // fallback
  image?: string;        // data URL, optional
  role?: string;         // 副标题
  accentColor?: string;  // ring color (hex / tailwind-ish)
  speaking?: boolean;
  dimmed?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}

const sizeMap = {
  sm: { box: 56, ring: 'ring-2', text: 'text-[11px]' },
  md: { box: 88, ring: 'ring-[3px]', text: 'text-xs' },
  lg: { box: 120, ring: 'ring-4', text: 'text-sm' },
};

export function Avatar({
  name,
  emoji,
  image,
  role,
  accentColor = '#2563eb',
  speaking = false,
  dimmed = false,
  size = 'md',
  onClick,
}: AvatarProps) {
  const s = sizeMap[size];

  return (
    <motion.div
      onClick={onClick}
      className={`flex flex-col items-center select-none ${onClick ? 'cursor-pointer' : ''}`}
      animate={{
        scale: speaking ? 1.08 : 1,
        opacity: dimmed ? 0.45 : 1,
      }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      <motion.div
        className="relative rounded-full overflow-hidden bg-white shadow-md flex items-center justify-center"
        style={{
          width: s.box,
          height: s.box,
          outline: speaking ? `3px solid ${accentColor}` : '3px solid transparent',
          outlineOffset: 3,
        }}
        animate={
          speaking
            ? { boxShadow: `0 0 0 0px ${accentColor}55, 0 8px 24px ${accentColor}33` }
            : { boxShadow: '0 4px 10px rgba(0,0,0,0.08)' }
        }
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span style={{ fontSize: s.box * 0.55 }}>{emoji || '🙂'}</span>
        )}

        {/* 说话时的外圈脉冲光环 */}
        {speaking && (
          <>
            <motion.span
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ border: `2px solid ${accentColor}` }}
              animate={{ scale: [1, 1.35, 1.6], opacity: [0.6, 0.2, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
            />
            <motion.span
              className="absolute inset-0 rounded-full pointer-events-none"
              style={{ border: `2px solid ${accentColor}` }}
              animate={{ scale: [1, 1.35, 1.6], opacity: [0.6, 0.2, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut', delay: 0.7 }}
            />
          </>
        )}
      </motion.div>

      {/* 波形条 */}
      {speaking && (
        <div className="flex items-end gap-[2px] mt-2 h-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <motion.span
              key={i}
              className="w-[3px] rounded-full"
              style={{ background: accentColor }}
              animate={{ height: ['20%', '100%', '35%', '85%', '20%'] }}
              transition={{
                duration: 0.6 + ((i * 37) % 5) * 0.08,
                repeat: Infinity,
                ease: 'easeInOut',
                delay: i * 0.05,
              }}
            />
          ))}
        </div>
      )}

      <div className="mt-2 text-center max-w-[140px]">
        <div className={`font-medium text-slate-800 truncate ${s.text}`}>{name}</div>
        {role && (
          <div className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
            {role}
          </div>
        )}
      </div>
    </motion.div>
  );
}
