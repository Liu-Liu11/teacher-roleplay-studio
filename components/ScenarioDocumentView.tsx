'use client';

/**
 * 右侧"场景文档"视图 —— 把 Scenario 当成一份可编辑的 Word 文档来呈现。
 *
 * 关键点：
 * 1. **同一个 Scenario 就是整个系统的唯一事实源**。这份文档呈现它，教师在这里编辑，
 *    pedagogy specialist 聊天产出的 scenarioPatch 会改它，refine 的 scenarioPatch 会改它，
 *    export 从它生成可便携 prompt，simulate / live / evaluate 都基于它。
 * 2. 视觉层：看起来像 Word——大标题、副标题、标号的段落、彩色 callout 区块。
 * 3. 交互层：任何字段都能就地编辑；textarea 自动增高；列表用简单的 "+/-" 操作。
 *
 * 不渲染任何 form label/input 装饰——给老师的感觉是"在读/写一份教案"。
 */

import { useEffect, useRef } from 'react';
import type {
  Scenario,
  Agent,
  PedagogicalTrap,
  RubricCriterion,
  CustomSection,
} from '@/lib/types';
import { useT } from '@/lib/useT';

type Patch = (p: Partial<Scenario>) => void;

export function ScenarioDocumentView({
  scenario,
  onPatch,
}: {
  scenario: Scenario;
  onPatch: Patch;
}) {
  const { t } = useT();

  function patchAgent(idx: number, patch: Partial<Agent>) {
    const next = [...scenario.agents];
    next[idx] = { ...next[idx], ...patch };
    onPatch({ agents: next });
  }
  function removeAgent(idx: number) {
    onPatch({ agents: scenario.agents.filter((_, i) => i !== idx) });
  }
  function addAgent() {
    onPatch({
      agents: [
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
      ],
    });
  }

  function patchTrap(idx: number, patch: Partial<PedagogicalTrap>) {
    const next = [...scenario.pedagogicalTraps];
    next[idx] = { ...next[idx], ...patch };
    onPatch({ pedagogicalTraps: next });
  }
  function addTrap() {
    onPatch({
      pedagogicalTraps: [
        ...scenario.pedagogicalTraps,
        { name: '', description: '', learningPoint: '' },
      ],
    });
  }

  function patchRubric(idx: number, patch: Partial<RubricCriterion>) {
    const next = [...scenario.rubric];
    next[idx] = { ...next[idx], ...patch };
    onPatch({ rubric: next });
  }
  function addRubric() {
    onPatch({
      rubric: [
        ...scenario.rubric,
        { name: '', description: '', maxScore: 10, indicators: [] },
      ],
    });
  }

  const customSections = scenario.customSections ?? [];
  function patchCustom(idx: number, patch: Partial<CustomSection>) {
    const next = [...customSections];
    next[idx] = { ...next[idx], ...patch };
    onPatch({ customSections: next });
  }
  function removeCustom(idx: number) {
    onPatch({ customSections: customSections.filter((_, i) => i !== idx) });
  }
  function moveCustom(idx: number, dir: -1 | 1) {
    const next = [...customSections];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onPatch({ customSections: next });
  }
  function addCustom(tone: Tone = 'slate') {
    const id = `sec_${Math.random().toString(36).slice(2, 10)}`;
    onPatch({
      customSections: [
        ...customSections,
        { id, title: '', body: '', tone },
      ],
    });
  }

  return (
    <div className="mx-auto max-w-[820px] px-10 py-10 bg-white text-slate-800 font-serif leading-relaxed">
      {/* ────── 文档标题 ────── */}
      <div className="mb-8 pb-6 border-b-2 border-slate-200">
        <InlineText
          value={scenario.title}
          onChange={(v) => onPatch({ title: v })}
          placeholder={t('doc_title_ph')}
          className="block text-4xl font-bold tracking-tight text-slate-900 font-sans"
        />
        <div className="flex items-center gap-3 mt-3 text-sm text-slate-500 font-sans">
          <InlineText
            value={scenario.discipline}
            onChange={(v) => onPatch({ discipline: v })}
            placeholder={t('doc_discipline_ph')}
            className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-medium text-xs"
          />
          <span>·</span>
          <span>v{scenario.version}</span>
          <span>·</span>
          <InlineText
            value={scenario.targetLearners}
            onChange={(v) => onPatch({ targetLearners: v })}
            placeholder={t('doc_learners_ph')}
            className="flex-1"
          />
        </div>
      </div>

      {/* ────── 1. 场景背景 ────── */}
      <Section title={t('doc_section_context')} tone="slate" index={1}>
        <InlineParagraph
          value={scenario.context}
          onChange={(v) => onPatch({ context: v })}
          placeholder={t('doc_context_ph')}
        />
      </Section>

      {/* ────── 2. 学习目标 ────── */}
      <Section title={t('doc_section_objectives')} tone="blue" index={2}>
        <NumberedList
          items={scenario.learningObjectives}
          onChange={(v) => onPatch({ learningObjectives: v })}
          placeholder={t('doc_objective_ph')}
          addHint={t('doc_add_objective')}
        />
      </Section>

      {/* ────── 3. 关键知识点 ────── */}
      <Section title={t('doc_section_knowledge')} tone="teal" index={3}>
        <NumberedList
          items={scenario.keyKnowledgePoints}
          onChange={(v) => onPatch({ keyKnowledgePoints: v })}
          placeholder={t('doc_knowledge_ph')}
          addHint={t('doc_add_knowledge')}
        />
      </Section>

      {/* ────── 4. 教学挑战点 ────── */}
      <Section title={t('doc_section_traps')} tone="amber" index={4}>
        {scenario.pedagogicalTraps.length === 0 && (
          <p className="italic text-sm text-slate-400 mb-3">{t('doc_traps_hint')}</p>
        )}
        <div className="space-y-4">
          {scenario.pedagogicalTraps.map((trap, i) => (
            <div
              key={i}
              className="relative pl-5 pr-3 py-3 rounded-r-lg border-l-4 border-amber-400 bg-amber-50/70"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-amber-700 font-semibold text-sm font-sans shrink-0">
                  {t('doc_trap_label', { i: i + 1 })}
                </span>
                <InlineText
                  value={trap.name}
                  onChange={(v) => patchTrap(i, { name: v })}
                  placeholder={t('doc_trap_name_ph')}
                  className="flex-1 font-semibold text-amber-900"
                />
                <RemoveBtn
                  onClick={() =>
                    onPatch({
                      pedagogicalTraps: scenario.pedagogicalTraps.filter(
                        (_, j) => j !== i
                      ),
                    })
                  }
                />
              </div>
              <InlineParagraph
                value={trap.description}
                onChange={(v) => patchTrap(i, { description: v })}
                placeholder={t('doc_trap_desc_ph')}
                className="mt-1.5 text-sm text-slate-700"
              />
              <div className="mt-2 text-sm text-emerald-800 flex gap-2 items-start">
                <span className="shrink-0 font-sans font-semibold text-xs mt-0.5">
                  {t('doc_trap_learning_label')}
                </span>
                <InlineParagraph
                  value={trap.learningPoint}
                  onChange={(v) => patchTrap(i, { learningPoint: v })}
                  placeholder={t('doc_trap_learning_ph')}
                  className="flex-1 italic"
                />
              </div>
            </div>
          ))}
        </div>
        <AddBtn onClick={addTrap} label={t('doc_add_trap')} tone="amber" />
      </Section>

      {/* ────── 5. 学生角色 ────── */}
      <Section title={t('doc_section_student')} tone="indigo" index={5}>
        <div className="space-y-2">
          <InlineHeading
            prefix={t('doc_student_role_prefix')}
            value={scenario.studentRole.name}
            onChange={(v) =>
              onPatch({ studentRole: { ...scenario.studentRole, name: v } })
            }
            placeholder={t('doc_student_name_ph')}
          />
          <InlineParagraph
            value={scenario.studentRole.description}
            onChange={(v) =>
              onPatch({ studentRole: { ...scenario.studentRole, description: v } })
            }
            placeholder={t('doc_student_desc_ph')}
          />
          <div className="mt-3 pt-3 border-t border-indigo-200/60">
            <div className="text-xs font-semibold text-indigo-700 font-sans mb-1.5">
              {t('doc_student_starting_label')}
            </div>
            <InlineParagraph
              value={scenario.studentRole.startingInfo}
              onChange={(v) =>
                onPatch({
                  studentRole: { ...scenario.studentRole, startingInfo: v },
                })
              }
              placeholder={t('doc_student_starting_ph')}
              className="text-sm"
            />
          </div>
        </div>
      </Section>

      {/* ────── 6. NPC ────── */}
      <Section title={t('doc_section_agents')} tone="violet" index={6}>
        <div className="space-y-5">
          {scenario.agents.map((agent, i) => (
            <div
              key={agent.id}
              className="relative rounded-xl border border-violet-200 bg-violet-50/40 overflow-hidden"
            >
              {/* NPC 头条：emoji + 姓名 + 身份 */}
              <div className="px-4 py-3 bg-violet-100/60 flex items-center gap-3 border-b border-violet-200/60">
                <InlineText
                  value={agent.avatar}
                  onChange={(v) => patchAgent(i, { avatar: v })}
                  placeholder="🤖"
                  className="w-10 text-center text-2xl"
                />
                <div className="flex-1 flex items-baseline gap-2">
                  <InlineText
                    value={agent.name}
                    onChange={(v) => patchAgent(i, { name: v })}
                    placeholder={t('doc_agent_name_ph')}
                    className="font-semibold text-violet-900 text-base"
                  />
                  <span className="text-violet-500 text-sm">·</span>
                  <InlineText
                    value={agent.role}
                    onChange={(v) => patchAgent(i, { role: v })}
                    placeholder={t('doc_agent_role_ph')}
                    className="italic text-sm text-violet-700"
                  />
                </div>
                <RemoveBtn onClick={() => removeAgent(i)} />
              </div>

              <div className="px-4 py-3 space-y-3 text-sm">
                <DocField label={t('doc_agent_persona_label')}>
                  <InlineParagraph
                    value={agent.persona}
                    onChange={(v) => patchAgent(i, { persona: v })}
                    placeholder={t('doc_agent_persona_ph')}
                  />
                </DocField>

                <DocField
                  label={t('doc_agent_knowledge_label')}
                  hint={t('doc_agent_knowledge_hint')}
                  accent="emerald"
                >
                  <InlineParagraph
                    value={agent.knowledge}
                    onChange={(v) => patchAgent(i, { knowledge: v })}
                    placeholder={t('doc_agent_knowledge_ph')}
                  />
                </DocField>

                <DocField
                  label={t('doc_agent_hidden_label')}
                  hint={t('doc_agent_hidden_hint')}
                  accent="rose"
                >
                  <InlineParagraph
                    value={agent.hiddenGoals}
                    onChange={(v) => patchAgent(i, { hiddenGoals: v })}
                    placeholder={t('doc_agent_hidden_ph')}
                  />
                </DocField>

                <DocField
                  label={t('doc_agent_guardrails_label')}
                  hint={t('doc_agent_guardrails_hint')}
                  accent="slate"
                >
                  <NumberedList
                    items={agent.guardrails ?? []}
                    onChange={(v) => patchAgent(i, { guardrails: v })}
                    placeholder={t('doc_agent_guardrail_ph')}
                    addHint={t('doc_add_guardrail')}
                    dense
                  />
                </DocField>
              </div>
            </div>
          ))}
        </div>
        <AddBtn onClick={addAgent} label={t('doc_add_agent')} tone="violet" />
      </Section>

      {/* ────── 7. 开场 ────── */}
      <Section title={t('doc_section_opening')} tone="slate" index={7}>
        <InlineParagraph
          value={scenario.openingBeat}
          onChange={(v) => onPatch({ openingBeat: v })}
          placeholder={t('doc_opening_ph')}
          className="italic"
        />
      </Section>

      {/* ────── 8. 发言与结束 ────── */}
      <Section title={t('doc_section_flow')} tone="slate" index={8}>
        <div className="flex items-baseline gap-3 text-sm font-sans mb-3">
          <span className="text-slate-600">{t('doc_max_turns_label')}</span>
          <input
            type="number"
            value={scenario.maxTurns}
            onChange={(e) =>
              onPatch({ maxTurns: parseInt(e.target.value, 10) || 30 })
            }
            className="w-20 px-2 py-1 rounded border border-slate-200 focus:border-brand-400 focus:outline-none"
          />
          <span className="text-slate-400 text-xs">{t('doc_max_turns_hint')}</span>
        </div>
        <div className="text-xs font-semibold text-slate-600 font-sans mb-1.5 uppercase tracking-wider">
          {t('doc_end_conditions_label')}
        </div>
        <NumberedList
          items={scenario.endConditions}
          onChange={(v) => onPatch({ endConditions: v })}
          placeholder={t('doc_end_condition_ph')}
          addHint={t('doc_add_end_condition')}
        />
      </Section>

      {/* ────── 9. Rubric ────── */}
      <Section title={t('doc_section_rubric')} tone="teal" index={9}>
        <div className="space-y-3">
          {scenario.rubric.map((c, i) => (
            <div
              key={i}
              className="rounded-lg border border-teal-200 bg-teal-50/50 px-4 py-3"
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-teal-700 font-sans font-semibold text-sm shrink-0">
                  {i + 1}.
                </span>
                <InlineText
                  value={c.name}
                  onChange={(v) => patchRubric(i, { name: v })}
                  placeholder={t('doc_rubric_name_ph')}
                  className="flex-1 font-semibold text-teal-900"
                />
                <span className="text-xs text-teal-600 font-sans">
                  / {' '}
                  <input
                    type="number"
                    value={c.maxScore}
                    onChange={(e) =>
                      patchRubric(i, {
                        maxScore: parseInt(e.target.value, 10) || 10,
                      })
                    }
                    className="w-12 px-1 py-0.5 bg-transparent text-teal-700 border-b border-teal-300 focus:outline-none text-center"
                  />
                </span>
                <RemoveBtn
                  onClick={() =>
                    onPatch({ rubric: scenario.rubric.filter((_, j) => j !== i) })
                  }
                />
              </div>
              <InlineParagraph
                value={c.description}
                onChange={(v) => patchRubric(i, { description: v })}
                placeholder={t('doc_rubric_desc_ph')}
                className="text-sm text-slate-700 mb-2"
              />
              <div className="text-xs font-semibold text-teal-700 font-sans mt-1.5 mb-1">
                {t('doc_rubric_indicators_label')}
              </div>
              <NumberedList
                items={c.indicators ?? []}
                onChange={(v) => patchRubric(i, { indicators: v })}
                placeholder={t('doc_rubric_indicator_ph')}
                addHint={t('doc_add_indicator')}
                dense
              />
            </div>
          ))}
        </div>
        <AddBtn onClick={addRubric} label={t('doc_add_rubric')} tone="teal" />
      </Section>

      {/* ────── 10. 复习策略 ────── */}
      <Section title={t('doc_section_review')} tone="blue" index={10}>
        <InlineParagraph
          value={scenario.reviewStrategy}
          onChange={(v) => onPatch({ reviewStrategy: v })}
          placeholder={t('doc_review_ph')}
        />
      </Section>

      {/* ────── 11+. 可延展的自定义章节 ──────
          老师或教学法专家可以在这里追加任何东西：多幕接力、课前材料、
          分支剧情、反思环节、额外规则……文档随对话生长，不再被固定结构框死。 */}
      {customSections.map((sec, i) => (
        <CustomSectionBlock
          key={sec.id}
          section={sec}
          index={11 + i}
          onPatch={(p) => patchCustom(i, p)}
          onRemove={() => removeCustom(i)}
          onMoveUp={i > 0 ? () => moveCustom(i, -1) : undefined}
          onMoveDown={
            i < customSections.length - 1 ? () => moveCustom(i, 1) : undefined
          }
        />
      ))}

      {/* + 添加新章节：一排色卡按钮，让老师可以按视觉语义挑一个颜色开写 */}
      <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-4">
        <div className="text-xs font-sans font-semibold text-slate-600 uppercase tracking-wider mb-2">
          {t('doc_add_custom_heading')}
        </div>
        <p className="text-xs text-slate-500 mb-3 font-sans">
          {t('doc_add_custom_hint')}
        </p>
        <div className="flex flex-wrap gap-2">
          {(['slate', 'blue', 'teal', 'amber', 'indigo', 'violet', 'rose'] as Tone[]).map(
            (tn) => (
              <button
                key={tn}
                type="button"
                onClick={() => addCustom(tn)}
                className={`text-xs font-sans px-3 py-1.5 rounded-lg border ${toneStyles[tn].border} ${toneStyles[tn].bg} ${toneStyles[tn].title} hover:shadow-sm transition`}
              >
                + {t(`doc_add_custom_${tn}` as any)}
              </button>
            )
          )}
        </div>
      </div>

      <div className="mt-12 pt-6 border-t border-slate-200 text-xs text-slate-400 font-sans italic text-center">
        {t('doc_footer_hint')}
      </div>
    </div>
  );
}

function CustomSectionBlock({
  section,
  index,
  onPatch,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  section: CustomSection;
  index: number;
  onPatch: (p: Partial<CustomSection>) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}) {
  const { t } = useT();
  const tone: Tone = section.tone ?? 'slate';
  const s = toneStyles[tone];
  return (
    <section className="mb-8 group">
      <h2
        className={`flex items-baseline gap-3 font-sans font-semibold text-xl ${s.title} mb-3`}
      >
        <span className="inline-block w-6 text-right text-slate-400 text-sm tabular-nums">
          {index}.
        </span>
        <InlineText
          value={section.title}
          onChange={(v) => onPatch({ title: v })}
          placeholder={t('doc_custom_title_ph')}
          className={`flex-1 font-semibold text-xl ${s.title}`}
        />
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity font-sans text-xs">
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              className="text-slate-400 hover:text-slate-700 px-1"
              title={t('doc_custom_move_up')}
            >
              ↑
            </button>
          )}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              className="text-slate-400 hover:text-slate-700 px-1"
              title={t('doc_custom_move_down')}
            >
              ↓
            </button>
          )}
          <ToneSwitcher
            value={tone}
            onChange={(tn) => onPatch({ tone: tn })}
          />
          <button
            type="button"
            onClick={onRemove}
            className="text-slate-400 hover:text-red-500 px-1"
            title={t('doc_custom_remove')}
          >
            ✕
          </button>
        </div>
      </h2>
      <div className={`pl-9 border-l-[3px] ${s.border} ${s.bg} rounded-r-lg py-2 pr-3`}>
        <InlineParagraph
          value={section.body}
          onChange={(v) => onPatch({ body: v })}
          placeholder={t('doc_custom_body_ph')}
        />
      </div>
    </section>
  );
}

/** 让老师随手换章节的视觉色彩——按一个小色点弹出色板 */
function ToneSwitcher({
  value,
  onChange,
}: {
  value: Tone;
  onChange: (t: Tone) => void;
}) {
  const tones: Tone[] = ['slate', 'blue', 'teal', 'amber', 'indigo', 'violet', 'rose'];
  return (
    <div className="relative inline-flex items-center gap-0.5 ml-1">
      {tones.map((tn) => (
        <button
          key={tn}
          type="button"
          onClick={() => onChange(tn)}
          className={`w-3 h-3 rounded-full border ${toneStyles[tn].dot} ${
            value === tn ? 'ring-2 ring-offset-1 ring-slate-500' : 'opacity-60 hover:opacity-100'
          }`}
          title={tn}
        />
      ))}
    </div>
  );
}

// ──────────────────────── UI 原子组件 ────────────────────────

type Tone = 'slate' | 'blue' | 'teal' | 'amber' | 'indigo' | 'violet' | 'rose';
const toneStyles: Record<Tone, { border: string; bg: string; title: string; dot: string }> = {
  slate: { border: 'border-slate-300', bg: 'bg-slate-50/50', title: 'text-slate-900', dot: 'bg-slate-400' },
  blue: { border: 'border-blue-300', bg: 'bg-blue-50/40', title: 'text-blue-900', dot: 'bg-blue-500' },
  teal: { border: 'border-teal-300', bg: 'bg-teal-50/40', title: 'text-teal-900', dot: 'bg-teal-500' },
  amber: { border: 'border-amber-300', bg: 'bg-amber-50/40', title: 'text-amber-900', dot: 'bg-amber-500' },
  indigo: { border: 'border-indigo-300', bg: 'bg-indigo-50/40', title: 'text-indigo-900', dot: 'bg-indigo-500' },
  violet: { border: 'border-violet-300', bg: 'bg-violet-50/40', title: 'text-violet-900', dot: 'bg-violet-500' },
  rose: { border: 'border-rose-300', bg: 'bg-rose-50/40', title: 'text-rose-900', dot: 'bg-rose-500' },
};

function Section({
  title,
  tone = 'slate',
  index,
  children,
}: {
  title: string;
  tone?: Tone;
  index?: number;
  children: React.ReactNode;
}) {
  const s = toneStyles[tone];
  return (
    <section className="mb-8 group">
      <h2
        className={`flex items-baseline gap-3 font-sans font-semibold text-xl ${s.title} mb-3`}
      >
        {index !== undefined && (
          <span className={`inline-block w-6 text-right text-slate-400 text-sm tabular-nums`}>
            {index}.
          </span>
        )}
        <span className="flex-1">{title}</span>
      </h2>
      <div className={`pl-9 border-l-[3px] ${s.border} ${s.bg} rounded-r-lg py-2 pr-3`}>
        {children}
      </div>
    </section>
  );
}

function InlineText({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`bg-transparent border-none outline-none focus:bg-brand-50/70 focus:ring-1 focus:ring-brand-300 rounded px-1 -mx-1 transition-colors w-full placeholder:text-slate-300 ${className}`}
    />
  );
}

/** 自增高的 textarea，看起来像是文档里的一段话，不像表单控件 */
function InlineParagraph({
  value,
  onChange,
  placeholder,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`block w-full bg-transparent border-none outline-none resize-none focus:bg-brand-50/70 focus:ring-1 focus:ring-brand-300 rounded px-1 -mx-1 py-0.5 transition-colors placeholder:text-slate-300 leading-relaxed ${className}`}
    />
  );
}

function InlineHeading({
  prefix,
  value,
  onChange,
  placeholder,
}: {
  prefix?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex items-baseline gap-2">
      {prefix && (
        <span className="font-sans font-semibold text-indigo-700 text-sm shrink-0">
          {prefix}
        </span>
      )}
      <InlineText
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="font-semibold text-indigo-900 flex-1"
      />
    </div>
  );
}

function NumberedList({
  items,
  onChange,
  placeholder,
  addHint,
  dense = false,
}: {
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  addHint?: string;
  dense?: boolean;
}) {
  const { t } = useT();
  const list = items ?? [];
  return (
    <div className={dense ? 'space-y-0.5' : 'space-y-1'}>
      {list.map((item, i) => (
        <div key={i} className="flex items-start gap-2 group/item">
          <span className="shrink-0 font-sans text-xs text-slate-400 tabular-nums mt-1 w-5 text-right">
            {i + 1}.
          </span>
          <InlineParagraph
            value={item}
            onChange={(v) => {
              const next = [...list];
              next[i] = v;
              onChange(next);
            }}
            placeholder={placeholder}
            className={dense ? 'text-sm' : ''}
          />
          <button
            type="button"
            onClick={() => onChange(list.filter((_, j) => j !== i))}
            className="opacity-0 group-hover/item:opacity-100 text-slate-300 hover:text-red-500 text-xs mt-1 px-1 shrink-0 transition-opacity"
            title={t('delete')}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...list, ''])}
        className="mt-1 ml-7 text-xs font-sans text-brand-600 hover:text-brand-800 hover:underline"
      >
        + {addHint || t('list_add_default')}
      </button>
    </div>
  );
}

function RemoveBtn({ onClick }: { onClick: () => void }) {
  const { t } = useT();
  return (
    <button
      type="button"
      onClick={onClick}
      className="opacity-50 hover:opacity-100 text-slate-400 hover:text-red-500 text-xs px-2 font-sans shrink-0"
      title={t('delete')}
    >
      ✕
    </button>
  );
}

function AddBtn({
  onClick,
  label,
  tone,
}: {
  onClick: () => void;
  label: string;
  tone: Tone;
}) {
  const s = toneStyles[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-4 w-full py-2 text-sm font-sans rounded-lg border border-dashed ${s.border} ${s.title} hover:${s.bg} transition-colors`}
    >
      + {label}
    </button>
  );
}

function DocField({
  label,
  hint,
  accent = 'slate',
  children,
}: {
  label: string;
  hint?: string;
  accent?: 'slate' | 'emerald' | 'rose';
  children: React.ReactNode;
}) {
  const accentClass =
    accent === 'emerald'
      ? 'text-emerald-700'
      : accent === 'rose'
      ? 'text-rose-700'
      : 'text-slate-600';
  return (
    <div>
      <div className={`text-xs font-semibold font-sans uppercase tracking-wider ${accentClass} mb-1`}>
        {label}
        {hint && (
          <span className="ml-2 font-normal normal-case tracking-normal text-slate-400 text-[11px]">
            — {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}
