'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Message } from './types';

type State = 'idle' | 'loading' | 'playing';

/**
 * 给每条消息提供一个"播放声音"的 hook。
 * - 同一时刻只允许一个音频在放
 * - 会缓存已经生成过的 dataURL，不重复调 API
 */
export function useAudioPlayer(apiKey: string) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cacheRef = useRef<Map<string, string>>(new Map());
  const [states, setStates] = useState<Record<string, State>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  const setState = (id: string, s: State) =>
    setStates((prev) => ({ ...prev, [id]: s }));

  const stop = useCallback(() => {
    audioRef.current?.pause();
    if (activeId) setState(activeId, 'idle');
    setActiveId(null);
  }, [activeId]);

  const play = useCallback(
    async (msg: Message) => {
      if (!apiKey) return;
      // 如果当前就是这条在播 → 停
      if (activeId === msg.id && states[msg.id] === 'playing') {
        stop();
        return;
      }
      // 停掉上一条
      if (audioRef.current) {
        audioRef.current.pause();
        if (activeId) setState(activeId, 'idle');
      }

      let dataUrl = cacheRef.current.get(msg.id);
      if (!dataUrl) {
        setState(msg.id, 'loading');
        setActiveId(msg.id);
        try {
          const res = await fetch('/api/generate/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: msg.content,
              agentId: msg.speakerId,
              apiKey,
            }),
          });
          const data = await res.json();
          if (data.error) throw new Error(data.error);
          dataUrl = data.dataUrl as string;
          cacheRef.current.set(msg.id, dataUrl);
        } catch (e: any) {
          console.warn('[tts] failed:', e.message);
          setState(msg.id, 'idle');
          setActiveId(null);
          return;
        }
      }

      const audio = new Audio(dataUrl);
      audioRef.current = audio;
      setState(msg.id, 'playing');
      setActiveId(msg.id);
      audio.onended = () => {
        setState(msg.id, 'idle');
        setActiveId(null);
      };
      audio.onerror = () => {
        setState(msg.id, 'idle');
        setActiveId(null);
      };
      audio.play().catch(() => {
        setState(msg.id, 'idle');
        setActiveId(null);
      });
    },
    [apiKey, activeId, states, stop]
  );

  const stateOf = useCallback((id: string): State => states[id] || 'idle', [states]);

  return { play, stop, stateOf, activeId };
}
