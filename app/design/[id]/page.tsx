'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useStudio } from '@/lib/store';
import { scenarioForNetwork } from '@/lib/prompts';
import { Button } from '@/components/Button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ApiKeySettingsButton, ApiKeyMissingBanner } from '@/components/ApiKeySettings';
import { ExportPromptsModal } from '@/components/ExportPromptsModal';
import { ScenarioDocumentView } from '@/components/ScenarioDocumentView';
import { useT } from '@/lib/useT';
import { t as tStatic } from '@/lib/i18n';
import type { PedagogyResponse, Scenario } from '@/lib/types';

export default function DesignPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const scenario = useStudio((s) => s.scenarios[id]);
  const updateScenario = useStudio((s) => s.updateScenario);
  const locale = useStudio((s) => s.locale);
  const userApiKey = useStudio((s) => s.userApiKey);
  const { t } = useT();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // reactStrictMode 在 dev 下会把 effect 执行两遍 → sendGreeting 并发发两次招呼 →
  // 老师会在聊天窗口看到两次"你好我是教学法专家……"。这里用一个 per-scenario ref
  // 做一次性守卫（只要针对这个 scenario.id 触发过一次就不会再触发第二次）。
  const greetedForIdRef = useRef<string | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [scenario?.pedagogyChat.length]);

  // 首次进入：如果还没聊过、且已经设置了 API key，自动发一个招呼
  useEffect(() => {
    if (!hydrated || !scenario) return;
    if (greetedForIdRef.current === scenario.id) return;
    if (scenario.pedagogyChat.length === 0 && !loading && userApiKey) {
      greetedForIdRef.current = scenario.id;
      sendGreeting();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, scenario?.id, userApiKey, locale]);

  if (!hydrated) {
    return <div className="p-10 text-slate-400">{t('loading')}</div>;
  }

  if (!scenario) {
    return (
      <div className="p-10">
        <p className="text-slate-500">{t('scenario_not_found')}</p>
        <Link href="/" className="text-brand-600 underline">
          {t('back_home')}
        </Link>
      </div>
    );
  }

  async function callPedagogy(
    userMessage: string,
    opts?: { hideUserFromChat?: boolean }
  ): Promise<boolean> {
    if (!userApiKey) {
      alert(t('apikey_missing_error'));
      return false;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/pedagogy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: scenarioForNetwork(scenario),
          userMessage,
          chatHistory: scenario.pedagogyChat,
          locale,
          apiKey: userApiKey,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as PedagogyResponse;

      const nowUser = {
        role: 'user' as const,
        content: userMessage,
        timestamp: Date.now(),
      };
      const nowAssistant = {
        role: 'assistant' as const,
        content: data.reply,
        timestamp: Date.now(),
      };

      // 首次进入的"请自我介绍"触发句是系统内部 bootstrap，不能当成老师的真实发言
      // 进聊天历史——否则老师一开场就看到自己"说"了一句莫名其妙的英文系统指令。
      const patchedChat = opts?.hideUserFromChat
        ? [...scenario.pedagogyChat, nowAssistant]
        : [...scenario.pedagogyChat, nowUser, nowAssistant];

      // 合并 scenarioPatch
      const patch: Partial<Scenario> = {
        pedagogyChat: patchedChat,
        ...(data.scenarioPatch || {}),
      };
      updateScenario(id, patch);
      return true;
    } catch (e: any) {
      alert(t('specialist_error', { msg: e.message }));
      return false;
    } finally {
      setLoading(false);
    }
  }

  async function sendGreeting() {
    // 触发句只发给 LLM 作为"请你先打招呼"的信号，不进老师看到的聊天历史
    await callPedagogy(t('first_visit_trigger'), { hideUserFromChat: true });
  }

  async function handleSend() {
    if (!input.trim() || loading) return;
    const msg = input.trim();
    // 关键：先不清空 input——如果 callPedagogy 因为网络/API-key/配额问题失败，
    // 老师刚刚打的那段话就蒸发了。只在成功时清空。
    const ok = await callPedagogy(msg);
    if (ok) setInput('');
  }

  // 老版本（在这次修复之前）曾把 first_visit_trigger 触发语当成用户消息持久化进 pedagogyChat。
  // 渲染时过滤掉——两种 locale 的触发句都要挡，因为老师可能切换过语言。
  const triggerZh = tStatic('zh', 'first_visit_trigger');
  const triggerEn = tStatic('en', 'first_visit_trigger');
  const chatHistory = scenario.pedagogyChat.filter(
    (m) => !(m.role === 'user' && (m.content === triggerZh || m.content === triggerEn))
  );
  // 更详细：不光给布尔值，还告诉老师**具体缺哪几样**，放在按钮 tooltip 里，
  // 免得老师看到按钮是灰的却不知道要填什么。
  const missingFields: string[] = [];
  if (scenario.agents.length === 0) missingFields.push(t('missing_field_agents'));
  if (!scenario.studentRole.name) missingFields.push(t('missing_field_student_role'));
  if (scenario.learningObjectives.length === 0) missingFields.push(t('missing_field_objectives'));
  const readyToRun = missingFields.length === 0;

  return (
    <main className="h-screen flex flex-col bg-white">
      <ApiKeyMissingBanner />
      {/* Top bar */}
      <header className="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 text-white px-6 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-indigo-200 hover:text-white text-sm">
            {t('back')}
          </Link>
          <input
            value={scenario.title}
            onChange={(e) => updateScenario(id, { title: e.target.value })}
            className="font-semibold text-lg bg-transparent border-none focus:outline-none focus:ring-2 focus:ring-cyan-300 rounded px-2 py-1 text-white placeholder-indigo-300/60"
            placeholder={t('title_placeholder')}
          />
          <span className="text-xs text-indigo-300/70">v{scenario.version}</span>
        </div>
        <div className="flex gap-2 items-center">
          <LanguageSwitcher />
          <ApiKeySettingsButton />
          <Button variant="secondary" onClick={() => setShowExport(true)}>
            {t('export')}
          </Button>
          <Button
            onClick={() => router.push(`/run/${id}`)}
            disabled={!readyToRun}
            title={
              readyToRun
                ? ''
                : t('run_test_disabled_with_fields', { list: missingFields.join(' · ') })
            }
          >
            {t('run_test')}
          </Button>
        </div>
      </header>

      {/* Main: 左边 Pedagogy Chat，右边 Scenario Draft */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Chat */}
        <div className="w-[55%] flex flex-col border-r border-slate-200 bg-slate-50">
          <div className="px-6 py-3 bg-white border-b border-slate-200">
            <h2 className="font-semibold text-slate-800">
              {t('specialist_title')}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {t('specialist_subtitle')}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin px-6 py-4 space-y-4">
            {chatHistory.map((msg, i) => (
              <div
                key={i}
                className={
                  msg.role === 'user'
                    ? 'flex justify-end'
                    : 'flex justify-start'
                }
              >
                <div
                  className={
                    msg.role === 'user'
                      ? 'max-w-[80%] bg-brand-600 text-white rounded-2xl rounded-br-sm px-4 py-2.5 prose-msg text-sm'
                      : 'max-w-[85%] bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 prose-msg text-sm text-slate-800'
                  }
                >
                  {msg.role === 'assistant' && (
                    <div className="text-xs text-brand-600 font-semibold mb-1">
                      {t('specialist_role_label')}
                    </div>
                  )}
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 text-sm text-slate-400">
                  {t('thinking')}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          <div className="border-t border-slate-200 bg-white p-4">
            <div className="flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder={t('input_placeholder')}
                className="flex-1 resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                rows={3}
                disabled={loading}
              />
              <Button onClick={handleSend} disabled={loading || !input.trim()}>
                {t('send')}
              </Button>
            </div>

            {readyToRun && (
              <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                {t('ready_to_run_banner')}
              </div>
            )}
          </div>
        </div>

        {/* Right: Scenario Document (Word-doc style) */}
        <div className="flex-1 overflow-y-auto scrollbar-thin bg-slate-50">
          <ScenarioDocumentView scenario={scenario} onPatch={(p) => updateScenario(id, p)} />
        </div>
      </div>

      {showExport && (
        <ExportPromptsModal scenario={scenario} onClose={() => setShowExport(false)} />
      )}
    </main>
  );
}

// 右侧"场景文档"视图已迁移到 components/ScenarioDocumentView.tsx（Word 文档样式）。
// 下面保留旧的结构化草稿视图（目前未启用），作为 reference，若需要可以在 design 页切回来。
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _LegacyScenarioDraftView({
  scenario,
  onPatch,
}: {
  scenario: Scenario;
  onPatch: (p: Partial<Scenario>) => void;
}) {
  const { t } = useT();

  function updateAgent(idx: number, patch: Partial<Scenario['agents'][number]>) {
    const next = [...scenario.agents];
    next[idx] = { ...next[idx], ...patch };
    onPatch({ agents: next });
  }

  return (
    <div className="p-6 space-y-6">
      <Section title={t('section_overview')}>
        <Field label={t('field_discipline')}>
          <input
            value={scenario.discipline}
            onChange={(e) => onPatch({ discipline: e.target.value })}
            placeholder={t('field_discipline_ph')}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('field_learners')}>
          <textarea
            value={scenario.targetLearners}
            onChange={(e) => onPatch({ targetLearners: e.target.value })}
            rows={2}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder={t('field_learners_ph')}
          />
        </Field>
        <Field label={t('field_context')}>
          <textarea
            value={scenario.context}
            onChange={(e) => onPatch({ context: e.target.value })}
            rows={4}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder={t('field_context_ph')}
          />
        </Field>
      </Section>

      <Section title={t('section_objectives')} count={scenario.learningObjectives.length}>
        <ListEditor
          items={scenario.learningObjectives}
          onChange={(v) => onPatch({ learningObjectives: v })}
          placeholder={t('objectives_ph')}
        />
      </Section>

      <Section title={t('section_knowledge')} count={scenario.keyKnowledgePoints.length}>
        <ListEditor
          items={scenario.keyKnowledgePoints}
          onChange={(v) => onPatch({ keyKnowledgePoints: v })}
          placeholder={t('knowledge_ph')}
        />
      </Section>

      <Section title={t('section_traps')} count={scenario.pedagogicalTraps.length}>
        {scenario.pedagogicalTraps.length === 0 && (
          <p className="text-xs text-slate-400 italic">{t('traps_hint')}</p>
        )}
        <div className="space-y-3">
          {scenario.pedagogicalTraps.map((trap, idx) => (
            <div key={idx} className="border border-amber-200 bg-amber-50 rounded-lg p-3">
              <input
                value={trap.name}
                onChange={(e) => {
                  const next = [...scenario.pedagogicalTraps];
                  next[idx] = { ...trap, name: e.target.value };
                  onPatch({ pedagogicalTraps: next });
                }}
                className="w-full font-medium text-sm bg-transparent border-none focus:outline-none"
                placeholder={t('trap_name_ph')}
              />
              <textarea
                value={trap.description}
                onChange={(e) => {
                  const next = [...scenario.pedagogicalTraps];
                  next[idx] = { ...trap, description: e.target.value };
                  onPatch({ pedagogicalTraps: next });
                }}
                rows={2}
                className="w-full text-xs text-slate-600 bg-transparent border-none focus:outline-none resize-none mt-1"
                placeholder={t('trap_desc_ph')}
              />
              <textarea
                value={trap.learningPoint}
                onChange={(e) => {
                  const next = [...scenario.pedagogicalTraps];
                  next[idx] = { ...trap, learningPoint: e.target.value };
                  onPatch({ pedagogicalTraps: next });
                }}
                rows={1}
                className="w-full text-xs text-green-700 bg-transparent border-none focus:outline-none resize-none mt-1"
                placeholder={t('trap_learning_ph')}
              />
              <button
                onClick={() => {
                  const next = scenario.pedagogicalTraps.filter((_, i) => i !== idx);
                  onPatch({ pedagogicalTraps: next });
                }}
                className="text-xs text-red-500 mt-1 hover:underline"
              >
                {t('delete')}
              </button>
            </div>
          ))}
        </div>
      </Section>

      <Section title={t('section_student_role')}>
        <Field label={t('sr_name')}>
          <input
            value={scenario.studentRole.name}
            onChange={(e) =>
              onPatch({
                studentRole: { ...scenario.studentRole, name: e.target.value },
              })
            }
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder={t('sr_name_ph')}
          />
        </Field>
        <Field label={t('sr_desc')}>
          <textarea
            value={scenario.studentRole.description}
            onChange={(e) =>
              onPatch({
                studentRole: { ...scenario.studentRole, description: e.target.value },
              })
            }
            rows={2}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('sr_starting')}>
          <textarea
            value={scenario.studentRole.startingInfo}
            onChange={(e) =>
              onPatch({
                studentRole: { ...scenario.studentRole, startingInfo: e.target.value },
              })
            }
            rows={3}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder={t('sr_starting_ph')}
          />
        </Field>
      </Section>

      <Section title={t('section_agents')} count={scenario.agents.length}>
        <div className="space-y-4">
          {scenario.agents.map((agent, idx) => (
            <details
              key={agent.id}
              className="border border-slate-200 rounded-lg p-3"
              open={idx === scenario.agents.length - 1}
            >
              <summary className="font-medium text-sm cursor-pointer select-none">
                <span className="text-xl mr-2">{agent.avatar || '🤖'}</span>
                {agent.name || t('agent_unnamed')}{' '}
                <span className="text-slate-400 font-normal">({agent.role})</span>
              </summary>
              <div className="mt-3 space-y-2 text-sm">
                <Field label={t('agent_name')}>
                  <input
                    value={agent.name}
                    onChange={(e) => updateAgent(idx, { name: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1"
                  />
                </Field>
                <Field label={t('agent_role')}>
                  <input
                    value={agent.role}
                    onChange={(e) => updateAgent(idx, { role: e.target.value })}
                    className="w-full rounded border border-slate-300 px-2 py-1"
                  />
                </Field>
                <Field label={t('agent_avatar')}>
                  <input
                    value={agent.avatar}
                    onChange={(e) => updateAgent(idx, { avatar: e.target.value })}
                    className="w-24 rounded border border-slate-300 px-2 py-1 text-center text-xl"
                  />
                </Field>
                <Field label={t('agent_persona')}>
                  <textarea
                    value={agent.persona}
                    onChange={(e) => updateAgent(idx, { persona: e.target.value })}
                    rows={3}
                    className="w-full rounded border border-slate-300 px-2 py-1"
                  />
                </Field>
                <Field label={t('agent_knowledge')}>
                  <textarea
                    value={agent.knowledge}
                    onChange={(e) => updateAgent(idx, { knowledge: e.target.value })}
                    rows={4}
                    className="w-full rounded border border-amber-300 bg-amber-50 px-2 py-1"
                    placeholder={t('agent_knowledge_ph')}
                  />
                </Field>
                <Field label={t('agent_hidden')}>
                  <textarea
                    value={agent.hiddenGoals}
                    onChange={(e) => updateAgent(idx, { hiddenGoals: e.target.value })}
                    rows={2}
                    className="w-full rounded border border-purple-300 bg-purple-50 px-2 py-1"
                  />
                </Field>
                <Field label={t('agent_guardrails')}>
                  <ListEditor
                    items={agent.guardrails}
                    onChange={(v) => updateAgent(idx, { guardrails: v })}
                    placeholder={t('agent_guardrail_ph')}
                  />
                </Field>
                <button
                  onClick={() => {
                    const next = scenario.agents.filter((_, i) => i !== idx);
                    onPatch({ agents: next });
                  }}
                  className="text-xs text-red-500 hover:underline"
                >
                  {t('agent_delete')}
                </button>
              </div>
            </details>
          ))}
          <button
            onClick={() => {
              const next = [
                ...scenario.agents,
                {
                  id: `agent_${Math.random().toString(36).slice(2, 8)}`,
                  name: '',
                  role: '',
                  avatar: '🤖',
                  persona: '',
                  knowledge: '',
                  hiddenGoals: '',
                  guardrails: [],
                },
              ];
              onPatch({ agents: next });
            }}
            className="w-full py-2 text-sm text-brand-600 border-2 border-dashed border-brand-300 rounded-lg hover:bg-brand-50"
          >
            {t('add_agent')}
          </button>
        </div>
      </Section>

      <Section title={t('section_rubric')} count={scenario.rubric.length}>
        <div className="space-y-3">
          {scenario.rubric.map((c, idx) => (
            <div key={idx} className="border border-slate-200 rounded-lg p-3 text-sm space-y-2">
              <div className="flex gap-2">
                <input
                  value={c.name}
                  onChange={(e) => {
                    const next = [...scenario.rubric];
                    next[idx] = { ...c, name: e.target.value };
                    onPatch({ rubric: next });
                  }}
                  placeholder={t('rubric_name_ph')}
                  className="flex-1 rounded border border-slate-300 px-2 py-1 font-medium"
                />
                <input
                  type="number"
                  value={c.maxScore}
                  onChange={(e) => {
                    const next = [...scenario.rubric];
                    next[idx] = { ...c, maxScore: parseInt(e.target.value) || 10 };
                    onPatch({ rubric: next });
                  }}
                  className="w-20 rounded border border-slate-300 px-2 py-1"
                />
              </div>
              <textarea
                value={c.description}
                onChange={(e) => {
                  const next = [...scenario.rubric];
                  next[idx] = { ...c, description: e.target.value };
                  onPatch({ rubric: next });
                }}
                rows={1}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
                placeholder={t('rubric_desc_ph')}
              />
              <ListEditor
                items={c.indicators}
                onChange={(v) => {
                  const next = [...scenario.rubric];
                  next[idx] = { ...c, indicators: v };
                  onPatch({ rubric: next });
                }}
                placeholder={t('rubric_indicators_ph')}
              />
              <button
                onClick={() => onPatch({ rubric: scenario.rubric.filter((_, i) => i !== idx) })}
                className="text-xs text-red-500 hover:underline"
              >
                {t('delete')}
              </button>
            </div>
          ))}
          <button
            onClick={() => {
              onPatch({
                rubric: [
                  ...scenario.rubric,
                  { name: '', description: '', maxScore: 10, indicators: [] },
                ],
              });
            }}
            className="w-full py-2 text-sm text-brand-600 border-2 border-dashed border-brand-300 rounded-lg hover:bg-brand-50"
          >
            {t('add_rubric')}
          </button>
        </div>
      </Section>

      <Section title={t('section_opening_end')}>
        <Field label={t('opening_label')}>
          <textarea
            value={scenario.openingBeat}
            onChange={(e) => onPatch({ openingBeat: e.target.value })}
            rows={3}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('max_turns_label')}>
          <input
            type="number"
            value={scenario.maxTurns}
            onChange={(e) => onPatch({ maxTurns: parseInt(e.target.value) || 30 })}
            className="w-32 rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label={t('end_conditions_label')}>
          <ListEditor
            items={scenario.endConditions}
            onChange={(v) => onPatch({ endConditions: v })}
            placeholder={t('end_conditions_ph')}
          />
        </Field>
      </Section>

      <Section title={t('section_review')}>
        <textarea
          value={scenario.reviewStrategy}
          onChange={(e) => onPatch({ reviewStrategy: e.target.value })}
          rows={3}
          className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder={t('review_ph')}
        />
      </Section>
    </div>
  );
}

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-semibold text-sm text-slate-700 mb-2 flex items-center gap-2">
        {title}
        {count !== undefined && (
          <span className="text-xs bg-slate-200 text-slate-600 rounded-full px-2 py-0.5">
            {count}
          </span>
        )}
      </h3>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-xs text-slate-500 block mb-1">{label}</span>
      {children}
    </label>
  );
}

function ListEditor({
  items,
  onChange,
  placeholder,
}: {
  items: string[] | undefined;
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const { t } = useT();
  const [draft, setDraft] = useState('');
  const list = items ?? [];
  return (
    <div>
      <div className="space-y-1">
        {list.map((item, idx) => (
          <div key={idx} className="flex gap-2 items-start">
            <span className="text-slate-400 text-sm mt-1">{idx + 1}.</span>
            <input
              value={item}
              onChange={(e) => {
                const next = [...list];
                next[idx] = e.target.value;
                onChange(next);
              }}
              className="flex-1 rounded border border-slate-200 px-2 py-1 text-sm"
            />
            <button
              onClick={() => onChange(list.filter((_, i) => i !== idx))}
              className="text-red-400 text-sm px-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && draft.trim()) {
              onChange([...list, draft.trim()]);
              setDraft('');
            }
          }}
          placeholder={placeholder || t('list_add_hint')}
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <button
          onClick={() => {
            if (!draft.trim()) return;
            onChange([...list, draft.trim()]);
            setDraft('');
          }}
          className="text-sm px-3 py-1 bg-slate-100 rounded hover:bg-slate-200"
        >
          +
        </button>
      </div>
    </div>
  );
}
