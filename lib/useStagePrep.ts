'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useStudio } from './store';
import { t } from './i18n';
import type { Scenario } from './types';

interface PrepState {
  stage: 'idle' | 'scene' | 'avatars' | 'done' | 'error';
  current?: string;    // 当前画哪个 NPC 的名字
  doneCount: number;
  totalCount: number;
  error?: string;
  /** 最近一次失败的任务（retry 时可能只重试失败的） */
  failed: Array<{ kind: 'scene' | 'avatar'; label: string; error: string }>;
}

export interface StagePrep extends PrepState {
  /** 手动触发重试——失败过的任务会重新跑，之前成功/已有的资产不会动 */
  retry: () => void;
}

/**
 * 进入运行页时自动给场景补齐多媒体资产：
 * - 没有 sceneImage → 生成背景图（优先）
 * - NPC 没有 avatarImage → 逐个生成头像
 * 已经有的就跳过。
 *
 * 错误处理原则：
 * - 任何一个任务失败都会把 stage 置为 'error'，并把错误消息保留在 state.error。
 * - 其他任务仍然继续跑（不让单点失败阻塞其他资产）。
 * - 用户可以调用 retry() 再试一次——只会重新跑失败/还没有资产的任务。
 * - key 变化或 scenario.id 变化时自动重置、重跑。
 */
export function useStagePrep(scenario: Scenario): StagePrep {
  const userApiKey = useStudio((s) => s.userApiKey);
  const updateScenario = useStudio((s) => s.updateScenario);
  const locale = useStudio((s) => s.locale);
  const [state, setState] = useState<PrepState>({
    stage: 'idle',
    doneCount: 0,
    totalCount: 0,
    failed: [],
  });
  const startedRef = useRef(false);
  const [retryNonce, setRetryNonce] = useState(0);

  const retry = useCallback(() => {
    startedRef.current = false;
    setState({ stage: 'idle', doneCount: 0, totalCount: 0, failed: [] });
    setRetryNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    // 每次 effect 重新计算缺什么
    const needScene = !scenario.sceneImage;
    const agentsNeedingAvatar = scenario.agents.filter((a) => !a.avatarImage);
    const total = (needScene ? 1 : 0) + agentsNeedingAvatar.length;

    if (total === 0) {
      setState({ stage: 'done', doneCount: 0, totalCount: 0, failed: [] });
      return;
    }
    if (!userApiKey) {
      setState({ stage: 'idle', doneCount: 0, totalCount: total, failed: [] });
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    let done = 0;
    const failures: Array<{ kind: 'scene' | 'avatar'; label: string; error: string }> = [];
    const CONCURRENCY = 3;

    async function genOne(kind: 'scene' | 'avatar', payload: any, label: string) {
      if (cancelled) return;
      setState((prev) => ({
        ...prev,
        stage: prev.stage === 'error' ? 'error' : (kind === 'scene' ? 'scene' : 'avatars'),
        current: label,
        doneCount: done,
        totalCount: total,
      }));
      try {
        const res = await fetch('/api/generate/image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, apiKey: userApiKey }),
        });
        const data = await res.json();
        if (cancelled) return;
        if (data.error) {
          const msg = `${kind === 'scene' ? t(locale, 'stage_scene_image_label') : label} — ${data.error}`;
          console.warn(`[stage-prep] ${kind} (${label}) failed:`, data.error);
          failures.push({ kind, label, error: data.error });
          // 任何一次失败都暴露到 UI——但不中断其他任务
          setState((prev) => ({
            ...prev,
            stage: 'error',
            error: msg,
            failed: [...failures],
          }));
        } else if (data.dataUrl) {
          if (kind === 'scene') {
            updateScenario(scenario.id, { sceneImage: data.dataUrl });
          } else {
            const fresh = useStudio.getState().scenarios[scenario.id];
            if (!fresh) return;
            const patched = fresh.agents.map((x) =>
              x.id === payload.__agentId ? { ...x, avatarImage: data.dataUrl } : x
            );
            updateScenario(scenario.id, { agents: patched });
          }
        }
      } catch (e: any) {
        console.warn(`[stage-prep] ${kind} (${label}) threw:`, e?.message);
        const msg = `${kind === 'scene' ? t(locale, 'stage_scene_image_label') : label} — ${e?.message || 'network error'}`;
        failures.push({ kind, label, error: e?.message || 'network error' });
        setState((prev) => ({
          ...prev,
          stage: 'error',
          error: msg,
          failed: [...failures],
        }));
      } finally {
        done += 1;
        if (!cancelled) {
          setState((prev) => {
            const allDone = done >= total;
            // 有失败就保持 error；没失败就按进度推进
            const nextStage: PrepState['stage'] =
              failures.length > 0
                ? 'error'
                : allDone
                ? 'done'
                : prev.stage === 'idle'
                ? prev.stage
                : prev.stage;
            return {
              ...prev,
              doneCount: done,
              stage: nextStage,
            };
          });
        }
      }
    }

    (async () => {
      const tasks: Array<() => Promise<void>> = [];
      if (needScene) {
        tasks.push(() =>
          genOne('scene', { kind: 'scene', prompt: buildScenePrompt(scenario) }, t(locale, 'stage_scene_label'))
        );
      }
      for (const a of agentsNeedingAvatar) {
        tasks.push(() =>
          genOne(
            'avatar',
            {
              kind: 'avatar',
              name: a.name,
              prompt: buildAvatarPrompt(a, scenario),
              __agentId: a.id,
            },
            a.name || 'NPC'
          )
        );
      }

      let i = 0;
      async function worker() {
        while (!cancelled && i < tasks.length) {
          const idx = i++;
          await tasks[idx]();
        }
      }
      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, () => worker())
      );
    })();

    return () => {
      cancelled = true;
      // ⚠️ React 19 + reactStrictMode 在开发模式下会 "mount → cleanup → mount" 双调用
      // 同一个 effect；如果不在 cleanup 里把 startedRef 清零，第二次 mount 的 effect
      // 会看到 startedRef===true 直接 return，导致场景图和头像**一次都不生成**。
      // 这里把 ref 清零，让第二次 effect 重新起跑；老闭包里的 fetch 由 cancelled 兜住，
      // 不会把旧结果再写回 store。
      startedRef.current = false;
    };
    // retryNonce 变了要重跑；scenario.id / apiKey 变了自然要重跑。
    // 不监听 sceneImage / agents 本身——那是我们自己写回去的，会造成循环。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id, userApiKey, retryNonce]);

  return { ...state, retry };
}

function buildScenePrompt(scenario: Scenario): string {
  const parts: string[] = [];
  if (scenario.context) parts.push(`Setting context: ${scenario.context}`);
  if (scenario.discipline) parts.push(`Discipline / field: ${scenario.discipline}`);
  if (scenario.openingBeat) parts.push(`Opening moment: ${scenario.openingBeat}`);
  if (scenario.studentRole?.description) {
    parts.push(`The student plays: ${scenario.studentRole.description}`);
  }
  if (scenario.agents.length) {
    parts.push(
      `Characters present: ` +
        scenario.agents.map((a) => `${a.name} (${a.role})`).join('; ')
    );
  }
  if (parts.length === 0) parts.push(`Generic educational roleplay setting: ${scenario.title}`);
  return parts.join('\n');
}

function buildAvatarPrompt(agent: { role: string; persona: string; name: string }, scenario: Scenario): string {
  return [
    `Role: ${agent.role}`,
    `Persona: ${(agent.persona || '').slice(0, 300)}`,
    scenario.discipline ? `Context: ${scenario.discipline} training scenario` : '',
    scenario.context ? `Setting: ${scenario.context.slice(0, 200)}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}
