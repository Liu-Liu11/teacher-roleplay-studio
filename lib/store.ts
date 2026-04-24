'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { nanoid } from 'nanoid';
import type { PromptLibraryEntry, Scenario, Session } from './types';
import { t, type Locale } from './i18n';

/**
 * 防抖 + 配额兜底的 localStorage 包装
 * ──────────────────────────────────────────
 * 问题：Zustand persist 默认每次 set() 都会 JSON.stringify 全量 state 写回 localStorage。
 * 在老师手下，设计页的每一次按键、每一次图片生成、每一次会话回合都会触发写入。
 * 几十 KB 到几 MB 的 blob，每次写几百毫秒 → 主线程阻塞 → 界面卡。
 *
 * 更致命：localStorage 单域 5MB 上限。sessions（完整 transcript）+ pedagogyChat
 * 无限增长，一旦超额，setItem 抛 QuotaExceededError，zustand 内部静默吞掉 ——
 * 用户点什么都像"没反应"，因为在内存里改了但写不进去，下次刷新全回滚。
 * 开无痕窗口是空 localStorage，所以能用。
 *
 * 这里做三件事：
 * 1. 写入防抖（400ms）：快速连打只最后一次真正落盘
 * 2. 离开页面前强制 flush：不丢最后一次改动
 * 3. 配额超了自动逐级丢掉老数据（sessions → promptLibrary → pedagogyChat）再重试
 */
const STORAGE_DEBOUNCE_MS = 400;

function rawSet(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * 配额超限时的渐进式瘦身：先丢一半 sessions → 全丢 sessions → 丢 promptLibrary →
 * 清空 pedagogyChat。每一步都重试，能成就停。用户的场景核心结构永远保留。
 */
function setWithEviction(key: string, value: string): void {
  if (rawSet(key, value)) return;
  let parsed: any;
  try {
    parsed = JSON.parse(value);
  } catch {
    return; // 反正都写不进去，放弃
  }
  const state = parsed?.state;
  if (!state) return;

  // 1) 丢一半最老的 sessions
  if (state.sessions && typeof state.sessions === 'object') {
    const entries = Object.entries<any>(state.sessions).sort(
      (a, b) => (b[1]?.startedAt ?? 0) - (a[1]?.startedAt ?? 0)
    );
    const half = Math.ceil(entries.length / 2);
    state.sessions = Object.fromEntries(entries.slice(0, half));
    if (rawSet(key, JSON.stringify(parsed))) return;
  }

  // 2) 全丢 sessions
  state.sessions = {};
  if (rawSet(key, JSON.stringify(parsed))) return;

  // 3) 丢 promptLibrary
  state.promptLibrary = [];
  if (rawSet(key, JSON.stringify(parsed))) return;

  // 4) 清空每个场景的 pedagogyChat
  if (state.scenarios && typeof state.scenarios === 'object') {
    for (const sid of Object.keys(state.scenarios)) {
      if (state.scenarios[sid]) state.scenarios[sid].pedagogyChat = [];
    }
  }
  rawSet(key, JSON.stringify(parsed)); // 尽力而为，不成就算了
}

let pendingKey: string | null = null;
let pendingValue: string | null = null;
let pendingTimer: ReturnType<typeof setTimeout> | null = null;

function flushPending() {
  if (pendingKey !== null && pendingValue !== null) {
    setWithEviction(pendingKey, pendingValue);
  }
  pendingKey = null;
  pendingValue = null;
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

if (typeof window !== 'undefined') {
  // 关标签前强制落盘，避免最后一次按键丢失
  window.addEventListener('beforeunload', flushPending);
  // 切后台时也 flush（移动端 beforeunload 不一定触发）
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushPending();
  });
}

const debouncedQuotaStorage = createJSONStorage(() => ({
  getItem: (k) => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(k);
  },
  setItem: (k, v) => {
    if (typeof window === 'undefined') return;
    pendingKey = k;
    pendingValue = v;
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = setTimeout(flushPending, STORAGE_DEBOUNCE_MS);
  },
  removeItem: (k) => {
    if (typeof window === 'undefined') return;
    if (pendingKey === k) {
      pendingKey = null;
      pendingValue = null;
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
    }
    window.localStorage.removeItem(k);
  },
}));

/**
 * API key fallback 单独小键
 * ────────────────────────
 * 主 zustand store 会把 {scenarios, sessions, pedagogyChat, promptLibrary, ...}
 * 整块 JSON 存到 localStorage。跑得多了之后这份 blob 会撑爆 ~5MB 配额，一旦
 * QuotaExceededError 抛出来，zustand persist 会静默失败 —— 结果是老师明明
 * 填了 API key，刷新后又"丢了"。
 *
 * 这里把 API key 另外写进一个独立的小键（几十字节），它几乎不会写不进去。
 * Rehydrate 时如果主 blob 里没有 key，就用 fallback 兜住。
 */
const API_KEY_LS = 'trp_user_api_key';

function readApiKeyFallback(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(API_KEY_LS) || '';
  } catch {
    return '';
  }
}

function writeApiKeyFallback(key: string) {
  if (typeof window === 'undefined') return;
  try {
    if (key) window.localStorage.setItem(API_KEY_LS, key);
    else window.localStorage.removeItem(API_KEY_LS);
  } catch {
    // 配额/隐私模式爆了也不要 crash —— 内存里的 state 还是活的
  }
}

interface StudioStore {
  scenarios: Record<string, Scenario>;
  sessions: Record<string, Session>;
  locale: Locale;
  /** 用户自己填的 API key，存在浏览器本地，不会发给第三方 */
  userApiKey: string;
  /** 老师的"Prompt 资产库"——导出的场景/评估 prompt 存在这里，跨场景可查 */
  promptLibrary: PromptLibraryEntry[];

  // UI 语言
  setLocale: (locale: Locale) => void;

  // API key
  setUserApiKey: (key: string) => void;

  // 场景增删改查
  createScenario: (seed?: Partial<Scenario>) => string;
  updateScenario: (id: string, patch: Partial<Scenario>) => void;
  deleteScenario: (id: string) => void;
  getScenario: (id: string) => Scenario | undefined;

  // 会话
  saveSession: (session: Session) => void;
  getSessionsByScenario: (scenarioId: string) => Session[];
  deleteSession: (id: string) => void;

  // Prompt 库
  saveToLibrary: (entry: Omit<PromptLibraryEntry, 'id' | 'savedAt'>) => string;
  deleteLibraryEntry: (id: string) => void;
  renameLibraryEntry: (id: string, name: string) => void;
}

function emptyScenario(id: string, seed?: Partial<Scenario>, _locale: Locale = 'zh'): Scenario {
  const now = Date.now();
  return {
    id,
    // title 默认留空；渲染层用 `s.title || t('unnamed')` 做 fallback，
    // 这样切语言时"未命名场景 / Unnamed Scenario"会跟着切换，而不是被烙死
    title: seed?.title || '',
    discipline: seed?.discipline || '',
    createdAt: now,
    updatedAt: now,
    version: 1,
    contentRevision: 1,
    learningObjectives: [],
    targetLearners: '',
    keyKnowledgePoints: [],
    pedagogicalTraps: [],
    reviewStrategy: '',
    context: '',
    studentRole: { name: '', description: '', startingInfo: '' },
    openingBeat: '',
    agents: [],
    turnPolicy: 'director_llm',
    // 真正有教学价值的多 NPC 群体场景通常要 50-80 轮才能展开冲突、升级、解决。
    // 默认给 60 是为了避免"10-20 轮寒暄完就结束，学不到东西"的 degenerate case。
    maxTurns: 60,
    endConditions: [],
    rubric: [],
    customSections: [],
    pedagogyChat: [],
    ...seed,
  };
}

export const useStudio = create<StudioStore>()(
  persist(
    (set, get) => ({
      scenarios: {},
      sessions: {},
      locale: 'zh',
      userApiKey: '',
      promptLibrary: [],

      setLocale: (locale) => set({ locale }),
      setUserApiKey: (key) => {
        const trimmed = key.trim();
        // 先写独立的 fallback 键（几乎不会失败），再写主 store。
        // 即便主 blob 因为配额爆了写不进去，fallback 这份一定稳。
        writeApiKeyFallback(trimmed);
        set({ userApiKey: trimmed });
      },

      createScenario: (seed) => {
        const id = nanoid(10);
        const scenario = emptyScenario(id, seed, get().locale);
        set((state) => ({ scenarios: { ...state.scenarios, [id]: scenario } }));
        return id;
      },

      updateScenario: (id, patch) => {
        set((state) => {
          const existing = state.scenarios[id];
          if (!existing) return state;

          // 如果 patch 里有结构化字段（agents/rubric等）变动，version + 1
          const structuralKeys: (keyof Scenario)[] = [
            'agents',
            'rubric',
            'pedagogicalTraps',
            'studentRole',
            'context',
            'openingBeat',
            'endConditions',
            'learningObjectives',
            'keyKnowledgePoints',
            'customSections',
          ];
          const hasStructural = structuralKeys.some((k) => k in patch);
          const updated: Scenario = {
            ...existing,
            ...patch,
            version: hasStructural ? existing.version + 1 : existing.version,
            // contentRevision 永远 +1：区分"同一结构化版本下的多次小改"（比如老师只改了
            // 标题/复习建议/场景介绍），让 library / export 文件名可以带 v2.r7 这样精确标记。
            contentRevision: (existing.contentRevision ?? 1) + 1,
            updatedAt: Date.now(),
          };
          return { scenarios: { ...state.scenarios, [id]: updated } };
        });
      },

      deleteScenario: (id) => {
        set((state) => {
          const next = { ...state.scenarios };
          delete next[id];
          return { scenarios: next };
        });
      },

      getScenario: (id) => get().scenarios[id],

      saveSession: (session) => {
        set((state) => ({ sessions: { ...state.sessions, [session.id]: session } }));
      },

      getSessionsByScenario: (scenarioId) => {
        return Object.values(get().sessions)
          .filter((s) => s.scenarioId === scenarioId)
          .sort((a, b) => b.startedAt - a.startedAt);
      },

      deleteSession: (id) => {
        set((state) => {
          const next = { ...state.sessions };
          delete next[id];
          return { sessions: next };
        });
      },

      saveToLibrary: (entry) => {
        const id = `lib_${nanoid(8)}`;
        const full: PromptLibraryEntry = {
          ...entry,
          id,
          savedAt: Date.now(),
        };
        const prev = get().promptLibrary;
        set((state) => ({ promptLibrary: [full, ...state.promptLibrary] }));
        // Zustand 的 persist 是 async/异步的；但它失败时没有原生的 rollback。
        // 做一次 probe：如果能序列化整个 promptLibrary 且体量 < 3.5MB（给其他 store
        // 项留 1.5MB 余量），认为大概率能落盘；否则把这一条 rollback 回去，抛可识别
        // 错误让 UI 提醒老师（"Prompt 库满了，请先删几条老的"）。
        try {
          const probe = JSON.stringify([full, ...prev]);
          // 5MB ≈ 5 * 1024 * 1024 characters；3.5MB 是软上限
          if (probe.length > 3.5 * 1024 * 1024) {
            set({ promptLibrary: prev });
            throw new Error(
              'Prompt library is full (localStorage quota almost reached). Delete some old entries first.'
            );
          }
        } catch (e: any) {
          if (e?.message?.startsWith('Prompt library is full')) throw e;
          // JSON.stringify 本身通常不抛，但以防万一
          set({ promptLibrary: prev });
          throw new Error('Failed to save to Prompt library: ' + (e?.message || 'unknown'));
        }
        return id;
      },

      deleteLibraryEntry: (id) => {
        set((state) => ({
          promptLibrary: state.promptLibrary.filter((e) => e.id !== id),
        }));
      },

      renameLibraryEntry: (id, name) => {
        set((state) => ({
          promptLibrary: state.promptLibrary.map((e) =>
            e.id === id ? { ...e, name } : e
          ),
        }));
      },
    }),
    {
      name: 'teacher-roleplay-studio',
      // v3：修 "未命名场景" 切语言不翻译的 bug（把烙死的默认 title 清空，让 UI 层翻译）
      version: 3,
      // 自定义 storage：防抖 + 配额超限时逐级丢数据。定义见文件顶部。
      storage: debouncedQuotaStorage,
      // ⚠️ 不要把 base64 图片 / 无界长对话 / 完整 session transcript 塞进 localStorage。
      // - 图片：有 sceneImage/avatarImage 就把它当缓存，刷新后 useStagePrep 再生成
      // - pedagogyChat：只留最近 40 条（约 20 轮专家对话），老的不影响后续设计
      // - sessions：每个场景只留最新 10 次，跨场景不做全局上限
      partialize: (state) => ({
        ...state,
        scenarios: Object.fromEntries(
          Object.entries(state.scenarios).map(([id, s]) => [
            id,
            {
              ...s,
              sceneImage: undefined,
              agents: s.agents.map((a) => ({ ...a, avatarImage: undefined })),
              pedagogyChat: (s.pedagogyChat || []).slice(-40),
            },
          ])
        ),
        sessions: (() => {
          // 按 scenarioId 分组，每组只保留最新 10 次；其他的扔掉避免撑爆配额。
          // "最新 10 次" 足够老师回顾近几次测试结果，再往前的历史价值递减。
          const byScenario = new Map<string, Session[]>();
          for (const sess of Object.values(state.sessions)) {
            if (!sess || typeof sess.scenarioId !== 'string') continue;
            const arr = byScenario.get(sess.scenarioId) || [];
            arr.push(sess);
            byScenario.set(sess.scenarioId, arr);
          }
          const kept: Session[] = [];
          for (const arr of byScenario.values()) {
            arr.sort((a, b) => (b.startedAt ?? 0) - (a.startedAt ?? 0));
            kept.push(...arr.slice(0, 10));
          }
          return Object.fromEntries(kept.map((s) => [s.id, s]));
        })(),
      }),
      migrate: (persistedState: any, version: number) => {
        if (!persistedState) return persistedState;
        // 老场景可能缺 schema 新增字段（数组字段 / rubric.indicators / agent.guardrails /
        // customSections 等）。统一用 emptyScenario 的默认值做浅兜底，避免 .map / .length 崩溃。
        if (persistedState.scenarios) {
          for (const [id, s] of Object.entries<any>(persistedState.scenarios)) {
            const patched: any = { ...s };
            let changed = false;
            if (!Array.isArray(s?.customSections)) {
              patched.customSections = [];
              changed = true;
            }
            // 老数据可能没有 contentRevision；用 version 兜底，保持单调递增的直觉
            if (typeof s?.contentRevision !== 'number') {
              patched.contentRevision = typeof s?.version === 'number' ? s.version : 1;
              changed = true;
            }
            // 历史 bug：早期版本把当时语言下的 "未命名场景 / Unnamed Scenario" 直接
            // 烙进 title 字段。切到另一种语言后 UI 不会跟着翻。这里把这两个默认值
            // 清空，让渲染层的 `s.title || t('unnamed')` 接手做实时翻译。
            // 老师自己起的名字不受影响。
            if (s?.title === '未命名场景' || s?.title === 'Unnamed Scenario') {
              patched.title = '';
              changed = true;
            }
            if (changed) persistedState.scenarios[id] = patched;
          }
        }
        if (version < 2 && persistedState.scenarios) {
          const patched: Record<string, Scenario> = {};
          for (const [id, s] of Object.entries<any>(persistedState.scenarios)) {
            patched[id] = {
              ...emptyScenario(id),
              ...s,
              studentRole: {
                name: '',
                description: '',
                startingInfo: '',
                ...(s?.studentRole ?? {}),
              },
              learningObjectives: s?.learningObjectives ?? [],
              keyKnowledgePoints: s?.keyKnowledgePoints ?? [],
              pedagogicalTraps: s?.pedagogicalTraps ?? [],
              endConditions: s?.endConditions ?? [],
              agents: (s?.agents ?? []).map((a: any) => ({
                ...a,
                guardrails: a?.guardrails ?? [],
              })),
              rubric: (s?.rubric ?? []).map((c: any) => ({
                ...c,
                indicators: c?.indicators ?? [],
              })),
              pedagogyChat: s?.pedagogyChat ?? [],
            };
          }
          persistedState.scenarios = patched;
        }
        if (!persistedState.locale) persistedState.locale = 'zh';
        if (persistedState.userApiKey === undefined) persistedState.userApiKey = '';
        if (!Array.isArray(persistedState.promptLibrary)) {
          persistedState.promptLibrary = [];
        } else {
          // 老版本里可能出现半成品/缺字段的 entry（比如历史上 kind 字段叫 'type'，
          // 或 savedAt 被存成 string）。全部过一遍形状校验，不合规的直接丢掉，
          // 避免之后 .map / toLocaleString 崩。
          persistedState.promptLibrary = persistedState.promptLibrary
            .filter((e: any) => {
              if (!e || typeof e !== 'object') return false;
              if (typeof e.id !== 'string' || !e.id) return false;
              if (typeof e.content !== 'string') return false;
              if (e.kind !== 'scenario' && e.kind !== 'evaluation') return false;
              return true;
            })
            .map((e: any) => ({
              id: e.id,
              scenarioId: typeof e.scenarioId === 'string' ? e.scenarioId : '',
              scenarioTitle: typeof e.scenarioTitle === 'string' ? e.scenarioTitle : 'untitled',
              scenarioVersion:
                typeof e.scenarioVersion === 'number' && Number.isFinite(e.scenarioVersion)
                  ? e.scenarioVersion
                  : 1,
              kind: e.kind,
              name: typeof e.name === 'string' && e.name ? e.name : 'untitled',
              content: e.content,
              savedAt:
                typeof e.savedAt === 'number' && Number.isFinite(e.savedAt)
                  ? e.savedAt
                  : Date.now(),
            }));
        }
        // ⚠️ 如果主 blob 里的 key 是空的（很可能是因为 localStorage 被塞爆导致
        // 老师后来重新填的 key 根本没写进来），用独立的 fallback 兜一下。
        if (!persistedState.userApiKey) {
          const fb = readApiKeyFallback();
          if (fb) persistedState.userApiKey = fb;
        }
        return persistedState;
      },
      // 主 blob 读成功但里面没有 userApiKey（例如配额炸在"输入 key"那一次
      // 之前，持久化里根本没这个字段）—— 兜底再检查一次 fallback。
      merge: (persistedState: any, currentState) => {
        const merged = { ...currentState, ...(persistedState || {}) };
        if (!merged.userApiKey) {
          const fb = readApiKeyFallback();
          if (fb) merged.userApiKey = fb;
        }
        return merged;
      },
    }
  )
);

export function createMessageId() {
  return `msg_${nanoid(8)}`;
}

export function createSessionId() {
  return `sess_${nanoid(8)}`;
}

export function createAgentId() {
  return `agent_${nanoid(6)}`;
}
