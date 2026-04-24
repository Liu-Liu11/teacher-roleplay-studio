'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useStudio, createMessageId, createSessionId } from '@/lib/store';
import { getLocalizedSimulatedStudents } from '@/lib/simulated-students';
import { Button } from '@/components/Button';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { ApiKeySettingsButton, ApiKeyMissingBanner } from '@/components/ApiKeySettings';
import { Stage } from '@/components/stage/Stage';
import { StageMediaControls } from '@/components/stage/StageMediaControls';
import { RefineScenarioButton } from '@/components/RefineScenarioButton';
import { useAudioPlayer } from '@/lib/useAudioPlayer';
import { useStagePrep } from '@/lib/useStagePrep';
import { useT } from '@/lib/useT';
import { formatDate } from '@/lib/utils';
import { scenarioForNetwork } from '@/lib/prompts';
import type { Evaluation, Message, Session } from '@/lib/types';

/**
 * Vercel 在 body 过大 / 函数超时 等情况下会返回**非 JSON 文本**（例如 "Request
 * Entity Too Large"）。直接 await res.json() 就会崩成 "Unexpected token 'R'"，
 * 老师根本看不懂。这里统一兜一下：先看 status，再尝试 JSON，实在不行把纯文本
 * 截断显示出来，至少让错误人话化。
 */
async function parseJsonOrThrow(res: Response): Promise<any> {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
    return data;
  }
  // 不是 JSON：Vercel 边缘层或上游错误
  const text = (await res.text()).trim();
  if (res.status === 413) {
    throw new Error(
      'Request too large (Vercel 4.5 MB limit). Try removing generated scene images / avatars or shortening the scenario.'
    );
  }
  if (res.status === 504 || /timeout/i.test(text)) {
    throw new Error('Server timeout. Try a shorter transcript or fewer NPCs.');
  }
  throw new Error(`HTTP ${res.status}: ${text.slice(0, 200) || 'non-JSON response'}`);
}

type Tab = 'live' | 'simulate' | 'history';

export default function RunPage() {
  const params = useParams();
  const id = params?.id as string;

  const scenario = useStudio((s) => s.scenarios[id]);
  const saveSession = useStudio((s) => s.saveSession);
  const getSessionsByScenario = useStudio((s) => s.getSessionsByScenario);
  const { t } = useT();

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [tab, setTab] = useState<Tab>('live');

  if (!hydrated) return <div className="p-10 text-slate-400">{t('loading')}</div>;
  if (!scenario) {
    return (
      <div className="p-10">
        {t('scenario_not_found')} ·{' '}
        <Link href="/" className="text-brand-600 underline">
          {t('back_home')}
        </Link>
      </div>
    );
  }

  const sessions = getSessionsByScenario(id);

  return (
    <main className="min-h-screen bg-slate-50">
      <ApiKeyMissingBanner />
      <header className="bg-gradient-to-r from-slate-900 via-indigo-900 to-slate-900 text-white px-6 py-3 flex items-center justify-between gap-4 shadow-md">
        <div className="flex items-center gap-4">
          <Link href={`/design/${id}`} className="text-indigo-200 hover:text-white text-sm">
            {t('back_to_design')}
          </Link>
          <h1 className="font-semibold text-lg tracking-tight">{scenario.title || t('unnamed')}</h1>
          <span className="text-xs text-indigo-300/70">v{scenario.version}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-white/10 backdrop-blur rounded-lg p-1">
            <TabBtn active={tab === 'live'} onClick={() => setTab('live')}>
              {t('tab_live')}
            </TabBtn>
            <TabBtn active={tab === 'simulate'} onClick={() => setTab('simulate')}>
              {t('tab_simulate')}
            </TabBtn>
            <TabBtn active={tab === 'history'} onClick={() => setTab('history')}>
              {t('tab_history', { n: sessions.length })}
            </TabBtn>
          </div>
          <LanguageSwitcher />
          <ApiKeySettingsButton />
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6">
        {tab === 'live' && <LivePanel scenario={scenario} onSessionDone={saveSession} />}
        {tab === 'simulate' && <SimulatePanel scenario={scenario} onSessionDone={saveSession} />}
        {tab === 'history' && (
          <HistoryPanel
            sessions={sessions}
            scenario={scenario}
            onSwitchTab={(next) => setTab(next)}
          />
        )}
      </div>
    </main>
  );
}

function TabBtn({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
        active
          ? 'bg-white text-slate-900 shadow'
          : 'text-indigo-100 hover:text-white hover:bg-white/10'
      }`}
    >
      {children}
    </button>
  );
}

// ───────────────────────── Live (真人试跑) ─────────────────────────
function LivePanel({ scenario, onSessionDone }: any) {
  const { t, locale } = useT();
  const userApiKey = useStudio((s) => s.userApiKey);
  const [transcript, setTranscript] = useState<Message[]>([]);
  const [studentInput, setStudentInput] = useState('');
  const [status, setStatus] = useState<'idle' | 'agent_thinking' | 'waiting_student' | 'ended'>('idle');
  const [endReason, setEndReason] = useState('');
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [evaluating, setEvaluating] = useState(false);
  // TTS 默认开：scenario.ttsEnabled 没显式设为 false 就当它是 on，避免每次 mount 都静音
  const [ttsEnabled, setTtsEnabled] = useState(scenario.ttsEnabled !== false);
  const audioPlayer = useAudioPlayer(userApiKey);
  const prep = useStagePrep(scenario);

  // Live 的 advance() 是 NPC→NPC 链式递归（每次 setTimeout(advance, 200)）。
  // 没有取消机制时：老师切到 Simulate/History tab 或卸载页面，链还在后台疯狂
  // 发请求 → 烧 API quota、最后 setState 到已卸载组件报警告。
  // 用一个"代数"ref：start() 每次递增 gen，advance() 只在它的 gen 等于当前 gen
  // 时继续；卸载或 endManually 直接 ++ 让残留链自然作废。
  const runGenRef = useRef(0);
  const abortLiveRef = useRef<AbortController | null>(null);
  useEffect(() => {
    return () => {
      runGenRef.current += 1;
      if (abortLiveRef.current) {
        try { abortLiveRef.current.abort(); } catch {}
        abortLiveRef.current = null;
      }
    };
  }, []);

  // TTS 自动播报最新 NPC 消息
  const lastMsg = transcript[transcript.length - 1];
  const lastAutoPlayedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!ttsEnabled || !lastMsg) return;
    if (lastMsg.speakerId === 'student' || lastMsg.speakerId === 'narrator') return;
    if (lastAutoPlayedRef.current === lastMsg.id) return;
    lastAutoPlayedRef.current = lastMsg.id;
    audioPlayer.play(lastMsg);
  }, [lastMsg?.id, ttsEnabled]);

  async function start() {
    if (!userApiKey) {
      alert(t('apikey_missing_error'));
      return;
    }
    // 新一轮会话 → 代数 +1，让上一轮残留的 setTimeout 链自动失效
    runGenRef.current += 1;
    const myGen = runGenRef.current;
    const initial: Message[] = [];
    if (scenario.openingBeat) {
      initial.push({
        id: createMessageId(),
        speakerId: 'narrator',
        speakerName: t('narrator'),
        content: scenario.openingBeat,
        timestamp: Date.now(),
      });
    }
    setTranscript(initial);
    setEvaluation(null);
    setEndReason('');
    setStatus('agent_thinking');
    await advance(initial, myGen);
  }

  async function advance(current: Message[], gen: number) {
    // 被老师切 tab / 卸载 / 手动 end / 重新 start 了 → 自己作废
    if (gen !== runGenRef.current) return;
    const controller = new AbortController();
    abortLiveRef.current = controller;
    try {
      const res = await fetch('/api/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: scenarioForNetwork(scenario),
          transcript: current,
          locale,
          apiKey: userApiKey,
        }),
        signal: controller.signal,
      });
      if (gen !== runGenRef.current) return; // 回来时已经过期
      const data = await parseJsonOrThrow(res);

      if (data.next === 'END') {
        setStatus('ended');
        setEndReason(data.reason || t('scenario_ended'));
        return;
      }
      if (data.next === 'STUDENT') {
        setStatus('waiting_student');
        return;
      }
      // AGENT 说话
      const msg: Message = {
        id: createMessageId(),
        speakerId: data.agentId,
        speakerName: data.agentName,
        content: data.content,
        timestamp: Date.now(),
      };
      const next = [...current, msg];
      setTranscript(next);
      setStatus('agent_thinking');
      // 继续推进一步（由 director 决定是否该学生）
      setTimeout(() => {
        if (gen === runGenRef.current) advance(next, gen);
      }, 200);
    } catch (err: any) {
      if (err?.name === 'AbortError' || gen !== runGenRef.current) return; // 用户主动取消，不弹错
      alert(t('run_failed', { msg: err.message }));
      setStatus('idle');
    } finally {
      if (abortLiveRef.current === controller) abortLiveRef.current = null;
    }
  }

  async function submitStudent() {
    if (!studentInput.trim()) return;
    const msg: Message = {
      id: createMessageId(),
      speakerId: 'student',
      speakerName: t('you_as', { role: scenario.studentRole.name }),
      content: studentInput.trim(),
      timestamp: Date.now(),
    };
    const next = [...transcript, msg];
    setTranscript(next);
    setStudentInput('');
    setStatus('agent_thinking');
    await advance(next, runGenRef.current);
  }

  function endManually() {
    // ++gen 让还在路上的 NPC 链自动作废，避免老师"结束"后又冒出一条 NPC 发言
    runGenRef.current += 1;
    if (abortLiveRef.current) {
      try { abortLiveRef.current.abort(); } catch {}
      abortLiveRef.current = null;
    }
    setStatus('ended');
    setEndReason(t('end_by_teacher'));
  }

  async function runEvaluation() {
    setEvaluating(true);
    try {
      const sessionId = createSessionId();
      const res = await fetch('/api/evaluate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: scenarioForNetwork(scenario),
          sessionId,
          transcript,
          runnerType: 'human_student',
          runnerName: t('teacher_self'),
          locale,
          apiKey: userApiKey,
        }),
      });
      const data = await parseJsonOrThrow(res);
      setEvaluation(data as Evaluation);

      const session: Session = {
        id: sessionId,
        scenarioId: scenario.id,
        scenarioVersion: scenario.version,
        runnerType: 'human_student',
        runnerId: 'teacher',
        runnerName: t('teacher_self'),
        transcript,
        status: 'completed',
        startedAt: transcript[0]?.timestamp || Date.now(),
        endedAt: Date.now(),
        evaluation: data,
      };
      onSessionDone(session);
    } catch (err: any) {
      alert(t('eval_failed', { msg: err.message }));
    } finally {
      setEvaluating(false);
    }
  }

  // 舞台上谁在"正在说"
  const speakingId =
    status === 'agent_thinking' ? null :
    status === 'waiting_student' ? null :
    transcript[transcript.length - 1]?.speakerId || null;

  const banner = (
    <div className="flex items-center justify-between gap-2">
      <div className="text-white drop-shadow">
        <div className="font-semibold text-sm flex items-center gap-2">
          {t('live_title')}
          <span className="text-[10px] bg-white/20 px-1.5 py-0.5 rounded-full font-normal">
            {t('running_on_version', { v: scenario.version })}
          </span>
        </div>
        <div className="text-xs opacity-80">
          {t('live_subtitle', {
            role: scenario.studentRole.name || t('role_student'),
            n: scenario.agents.length,
          })}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <StageMediaControls
          ttsEnabled={ttsEnabled}
          onToggleTts={() => setTtsEnabled((v) => !v)}
          prepStage={prep.stage}
          prepCurrent={prep.current}
          prepDone={prep.doneCount}
          prepTotal={prep.totalCount}
          prepError={prep.error}
          onRetry={prep.retry}
        />
        {status === 'idle' && (
          <Button onClick={start}>{t('start')}</Button>
        )}
        {(status === 'agent_thinking' || status === 'waiting_student') && (
          <Button variant="secondary" onClick={endManually}>
            {t('end_manual')}
          </Button>
        )}
        {status === 'ended' && (
          <Button onClick={start} variant="secondary">
            {t('restart')}
          </Button>
        )}
      </div>
    </div>
  );

  const footer =
    status === 'idle' ? (
      <div className="text-white/80 text-sm italic">
        {t('empty_live')}
      </div>
    ) : status === 'waiting_student' ? (
      <div className="flex gap-2">
        <textarea
          value={studentInput}
          onChange={(e) => setStudentInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submitStudent();
            }
          }}
          rows={2}
          placeholder={t('student_input_ph', {
            role: scenario.studentRole.name || t('role_student'),
          })}
          className="flex-1 rounded-xl bg-white/95 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-300"
          autoFocus
        />
        <Button onClick={submitStudent} disabled={!studentInput.trim()}>
          {t('send')}
        </Button>
      </div>
    ) : status === 'ended' ? (
      <div className="flex items-center justify-between text-white">
        <div>
          <div className="font-semibold">{t('scenario_ended')}</div>
          <div className="text-xs opacity-75">{endReason}</div>
        </div>
        {transcript.length > 1 && (
          <Button onClick={runEvaluation} disabled={evaluating}>
            {evaluating ? t('generating_eval') : t('generate_eval')}
          </Button>
        )}
      </div>
    ) : (
      <div className="text-white/80 text-xs italic">{t('ai_thinking')}</div>
    );

  return (
    <div className="space-y-4">
      <Stage
        scenario={scenario}
        transcript={transcript}
        currentSpeakerId={speakingId}
        thinking={status === 'agent_thinking'}
        studentName={scenario.studentRole.name || t('role_student')}
        audioEnabled={ttsEnabled}
        onPlayAudio={(m) => audioPlayer.play(m)}
        audioStateOf={(id) => audioPlayer.stateOf(id)}
        banner={banner}
        footer={footer}
      />
      {evaluation && (
        <div className="space-y-3">
          <EvaluationView evaluation={evaluation} />
          <div className="bg-gradient-to-r from-brand-50 to-white border border-brand-200 rounded-xl p-4 flex items-center justify-between gap-3">
            <div className="text-sm text-slate-700">
              <div className="font-semibold">{t('refine_cta')}</div>
              <div className="text-xs text-slate-500">
                {t('refine_applied_toast', { v: scenario.version + 1 }).replace(/\{.+?\}/g, '…')}
              </div>
            </div>
            <RefineScenarioButton
              scenario={scenario}
              evaluations={[
                {
                  runnerName: t('teacher_self'),
                  runnerType: 'human_student',
                  evaluation,
                },
              ]}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Simulate (模拟学生) ─────────────────────────
function SimulatePanel({ scenario, onSessionDone }: any) {
  const { t, locale } = useT();
  const userApiKey = useStudio((s) => s.userApiKey);
  const personas = getLocalizedSimulatedStudents(locale);
  // 打开 Simulate 时也自动补齐舞台资产（如果 Live 还没跑过的话）
  useStagePrep(scenario);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<
    Array<{
      studentId: string;
      studentName: string;
      studentAvatar: string;
      transcript: Message[];
      evaluation: Evaluation | null;
      endReason: string;
      /** 稳定的结束原因枚举——用来 t() 渲染；老记录没有则回退到 endReason 字符串 */
      endReasonCode?:
        | 'normal'
        | 'director_ended'
        | 'student_ended'
        | 'agent_not_found'
        | 'max_turns';
      sessionId: string;
      /** 跑这一条用的 scenario 版本号（便于 UI 标注） */
      scenarioVersion: number;
    }>
  >([]);
  const [currentlyRunning, setCurrentlyRunning] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  // 非阻塞错误列表：替代原来的 alert(sim_failed)，alert 会把 for 循环卡住让老师
  // 必须点掉每一个弹窗才能继续，体验很差；现在失败的学生直接记到 results 行里 + 顶部横幅
  const [batchErrors, setBatchErrors] = useState<Array<{ studentName: string; msg: string }>>([]);

  function toggle(id: string) {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelected(n);
  }

  async function run() {
    if (selected.size === 0) return;
    if (!userApiKey) {
      alert(t('apikey_missing_error'));
      return;
    }
    // 快照 scenario：中途可能有人点 "refine"，batch 要以"按下 Run 时的版本"为准，
    // 这样 scenarioVersion 标注 / 传给 API 的都是一致的一份，避免 batch 里一半新版一半旧版。
    const frozenScenario = scenario;
    setRunning(true);
    setResults([]);
    setBatchErrors([]);
    setProgress({ done: 0, total: selected.size });
    const allResults: typeof results = [];
    const allErrors: typeof batchErrors = [];
    let doneCount = 0;

    for (const studentId of selected) {
      const persona = personas.find((s) => s.id === studentId)!;
      setCurrentlyRunning(persona.name);
      try {
        // 1. 跑完整会话
        const simRes = await fetch('/api/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            scenario: scenarioForNetwork(frozenScenario),
            simulatedStudentId: studentId,
            locale,
            apiKey: userApiKey,
          }),
        });
        const simData = await parseJsonOrThrow(simRes);

        const sessionId = createSessionId();
        const transcript: Message[] = simData.transcript;
        const endReason: string = simData.endReason;
        const endReasonCode = simData.endReasonCode as
          | 'normal'
          | 'director_ended'
          | 'student_ended'
          | 'agent_not_found'
          | 'max_turns'
          | undefined;

        // 2. 评估——**评估失败不丢 transcript**。原来 evalRes 出错会直接 throw，
        // 整个 session 不入库，老师看不到刚刚跑出来的对话，浪费 API 成本。
        let evaluation: any = null;
        let evalError: string | null = null;
        try {
          const evalRes = await fetch('/api/evaluate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              scenario: scenarioForNetwork(frozenScenario),
              sessionId,
              transcript,
              runnerType: 'simulated_student',
              runnerName: persona.name,
              locale,
              apiKey: userApiKey,
            }),
          });
          try {
            evaluation = await parseJsonOrThrow(evalRes);
          } catch (e: any) {
            evalError = e?.message || 'evaluate failed';
          }
        } catch (e: any) {
          evalError = e?.message || 'evaluate failed';
        }

        const session: Session = {
          id: sessionId,
          scenarioId: frozenScenario.id,
          scenarioVersion: frozenScenario.version,
          runnerType: 'simulated_student',
          runnerId: studentId,
          runnerName: persona.name,
          transcript,
          status: 'completed',
          startedAt: transcript[0]?.timestamp || Date.now(),
          endedAt: Date.now(),
          evaluation: evaluation ?? undefined,
        };
        onSessionDone(session);

        allResults.push({
          studentId,
          studentName: persona.name,
          studentAvatar: persona.avatar,
          transcript,
          evaluation,
          endReason,
          endReasonCode,
          sessionId,
          scenarioVersion: frozenScenario.version,
        });
        setResults([...allResults]);
        if (evalError) {
          allErrors.push({ studentName: persona.name, msg: `evaluate: ${evalError}` });
          setBatchErrors([...allErrors]);
        }
      } catch (err: any) {
        // 不再 alert，把失败堆到 batchErrors 横幅里一次性展示
        allErrors.push({ studentName: persona.name, msg: err?.message || 'run failed' });
        setBatchErrors([...allErrors]);
      } finally {
        doneCount += 1;
        setProgress({ done: doneCount, total: selected.size });
      }
    }
    setCurrentlyRunning(null);
    setRunning(false);
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="font-semibold text-lg">{t('sim_title')}</h2>
            <p className="text-xs text-slate-500 mt-1">{t('sim_subtitle')}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {personas.map((s) => {
            const on = selected.has(s.id);
            return (
              <button
                key={s.id}
                onClick={() => toggle(s.id)}
                disabled={running}
                className={`relative text-left border-2 rounded-xl p-3 transition-all overflow-hidden ${
                  on
                    ? 'border-brand-500 bg-gradient-to-br from-brand-50 to-white shadow-md scale-[1.02]'
                    : 'border-slate-200 hover:border-brand-300 hover:shadow'
                } disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {on && (
                  <div className="absolute top-1.5 right-2 text-brand-600 text-xs">✓</div>
                )}
                <div className="text-3xl mb-1">{s.avatar}</div>
                <div className="font-medium text-sm truncate">{s.name}</div>
                <div className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                  {s.behaviorTraits.slice(0, 2).join(locale === 'en' ? ', ' : '、')}
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <Button onClick={run} disabled={running || selected.size === 0}>
            {running
              ? t('sim_running', { name: currentlyRunning || '…' })
              : t('run_selected', { n: selected.size })}
          </Button>
          {running && progress.total > 0 && (
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-mono">
                {progress.done} / {progress.total}
              </span>
              <div className="w-32 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand-500 transition-all"
                  style={{
                    width: `${Math.round((progress.done / progress.total) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}
          <span className="text-xs text-slate-500">{t('sim_time_hint')}</span>
        </div>

        {batchErrors.length > 0 && (
          <div className="mt-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <div className="font-semibold mb-1">
              {batchErrors.length} {batchErrors.length === 1 ? 'run' : 'runs'} had issues:
            </div>
            <ul className="space-y-0.5">
              {batchErrors.map((e, i) => (
                <li key={i}>
                  <span className="font-mono">{e.studentName}</span> — {e.msg}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {results.length > 0 && <TestResultsMatrix results={results} scenario={scenario} />}

      {results.filter((r) => r.evaluation).length > 0 && (
        <div className="bg-gradient-to-r from-brand-50 to-white border border-brand-200 rounded-xl p-4 flex items-center justify-between gap-3">
          <div className="text-sm text-slate-700 flex-1">
            <div className="font-semibold">
              {t('refine_cta_multi', {
                n: results.filter((r) => r.evaluation).length,
              })}
            </div>
            <div className="text-xs text-slate-500">
              {t('refine_summary_label')} → {t('refine_apply')}
            </div>
          </div>
          <RefineScenarioButton
            scenario={scenario}
            evaluations={results
              .filter((r) => r.evaluation)
              .map((r) => ({
                runnerName: r.studentName,
                runnerType: 'simulated_student' as const,
                evaluation: r.evaluation!,
              }))}
          />
        </div>
      )}

      {results.map((r) => (
        <div key={r.sessionId} className="bg-white rounded-xl border border-slate-200 p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <span>
              {t('result_title', { avatar: r.studentAvatar, name: r.studentName })}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-normal ${
                r.scenarioVersion === scenario.version
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-amber-100 text-amber-700'
              }`}
              title={t('history_ran_on_version', { v: r.scenarioVersion })}
            >
              v{r.scenarioVersion}
            </span>
          </h3>
          <details className="mb-4">
            <summary className="cursor-pointer text-sm text-slate-600 hover:text-slate-900">
              {t('view_full_convo', { n: r.transcript.length })}
            </summary>
            <div className="mt-3">
              <Stage
                scenario={scenario}
                transcript={r.transcript}
                studentName={`${r.studentAvatar} ${r.studentName}`}
                studentEmoji={r.studentAvatar}
              />
            </div>
          </details>
          {r.evaluation ? (
            <EvaluationView evaluation={r.evaluation} />
          ) : (
            <div className="text-sm text-red-500">{t('eval_gen_failed')}</div>
          )}
        </div>
      ))}
    </div>
  );
}

function TestResultsMatrix({ results, scenario }: { results: any[]; scenario: any }) {
  const { t } = useT();
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h2 className="font-semibold mb-3">{t('matrix_title')}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th className="py-2 px-3">{t('col_student')}</th>
              <th className="py-2 px-3">v</th>
              <th className="py-2 px-3">{t('col_performance')}</th>
              <th className="py-2 px-3">{t('col_fidelity')}</th>
              <th className="py-2 px-3">{t('col_hallu')}</th>
              <th className="py-2 px-3">{t('col_issues')}</th>
              <th className="py-2 px-3">{t('col_end_reason')}</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => {
              const evalRes = r.evaluation;
              if (!evalRes) {
                return (
                  <tr key={r.sessionId} className="border-b border-slate-100">
                    <td className="py-2 px-3">{r.studentName}</td>
                    <td className="py-2 px-3 text-xs text-slate-500">
                      v{r.scenarioVersion}
                    </td>
                    <td colSpan={5} className="text-slate-400">
                      {t('eval_fail_row')}
                    </td>
                  </tr>
                );
              }
              const avgFidelity =
                evalRes.agentFidelity.length > 0
                  ? Math.round(
                      (evalRes.agentFidelity.reduce(
                        (a: number, x: any) => a + x.score,
                        0
                      ) /
                        evalRes.agentFidelity.length) *
                        10
                    ) / 10
                  : 0;
              return (
                <tr key={r.sessionId} className="border-b border-slate-100">
                  <td className="py-2 px-3 font-medium">{r.studentName}</td>
                  <td className="py-2 px-3">
                    <span
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        r.scenarioVersion === scenario.version
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      v{r.scenarioVersion}
                    </span>
                  </td>
                  <td className="py-2 px-3">
                    <ScoreBar value={evalRes.studentPerformance.overallScore} max={100} />
                  </td>
                  <td className="py-2 px-3">{avgFidelity}/10</td>
                  <td className="py-2 px-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs ${
                        evalRes.hallucinations.length === 0
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {evalRes.hallucinations.length}
                    </span>
                  </td>
                  <td className="py-2 px-3">{evalRes.scenarioDesignIssues.length}</td>
                  <td className="py-2 px-3 text-xs text-slate-500">
                    {/* 新记录走稳定的 code → t()（老师切语言后跟着变）；
                        老记录没有 code，退回原始字符串，保持旧会话向后兼容 */}
                    {renderEndReason(r.endReasonCode, r.endReason, t)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * 把 API 返回的 endReasonCode 映射到已有的 i18n key。
 * 老 session 没有 code → 回退展示原始 endReason 字符串（可能是它生成时那刻的语言，
 * 无法再本地化，但至少信息还在）。
 */
function renderEndReason(
  code: string | undefined,
  fallback: string,
  t: (k: any, v?: Record<string, string | number>) => string
): string {
  if (!code) return fallback || '';
  switch (code) {
    case 'normal':
      return t('end_reason_normal');
    case 'director_ended':
      return t('end_reason_director');
    case 'student_ended':
      return t('end_reason_student');
    case 'agent_not_found':
      return t('end_reason_no_agent');
    case 'max_turns':
      return t('end_reason_max_turns');
    default:
      return fallback || code;
  }
}

function ScoreBar({ value, max }: { value: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const color =
    pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-yellow-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
        <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-600">
        {value}/{max}
      </span>
    </div>
  );
}

// ───────────────────────── History ─────────────────────────
function HistoryPanel({
  sessions,
  scenario,
  onSwitchTab,
}: {
  sessions: Session[];
  scenario: any;
  onSwitchTab?: (t: Tab) => void;
}) {
  const { t } = useT();
  const [selectedId, setSelectedId] = useState<string | null>(sessions[0]?.id ?? null);
  const selected = sessions.find((s) => s.id === selectedId);

  if (sessions.length === 0) {
    return (
      <div className="text-center text-slate-400 py-20 bg-white rounded-xl border border-slate-200">
        {t('empty_history')}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-1 bg-white rounded-xl border border-slate-200 p-3 max-h-[700px] overflow-y-auto">
        {sessions.map((s) => {
          const isStale = s.scenarioVersion !== scenario.version;
          return (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`w-full text-left p-3 rounded-lg mb-2 transition-colors ${
                selectedId === s.id ? 'bg-brand-50 border border-brand-300' : 'hover:bg-slate-50'
              }`}
            >
              <div className="font-medium text-sm flex items-center gap-2">
                <span>
                  {s.runnerType === 'simulated_student' ? '🤖' : '👤'} {s.runnerName}
                </span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    isStale
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                  title={isStale ? t('history_current_version', { v: scenario.version }) : ''}
                >
                  v{s.scenarioVersion}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {formatDate(s.startedAt)}
              </div>
              {s.evaluation && (
                <div className="text-xs mt-1">
                  {t('history_score', { s: s.evaluation.studentPerformance.overallScore })}
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="col-span-2">
        {selected ? (
          <div className="space-y-4">
            {/* Version context strip — always visible so the teacher knows
                WHICH version of the scenario this session actually ran on */}
            <div
              className={`rounded-xl border px-4 py-3 text-sm flex items-center justify-between gap-3 ${
                selected.scenarioVersion === scenario.version
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                  : 'border-amber-300 bg-amber-50 text-amber-900'
              }`}
            >
              <div>
                <div className="font-semibold">
                  {selected.runnerType === 'simulated_student' ? '🤖' : '👤'}{' '}
                  {selected.runnerName} ·{' '}
                  {t('history_ran_on_version', { v: selected.scenarioVersion })}
                </div>
                {selected.scenarioVersion !== scenario.version && (
                  <div className="text-xs mt-0.5">
                    {t('history_version_mismatch', {
                      sv: selected.scenarioVersion,
                      cv: scenario.version,
                    })}
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-shrink-0">
                {onSwitchTab && (
                  <>
                    <button
                      onClick={() => onSwitchTab('live')}
                      className="text-xs px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-brand-400 hover:text-brand-700"
                    >
                      {t('history_rerun_current', { v: scenario.version })}
                    </button>
                    <button
                      onClick={() => onSwitchTab('simulate')}
                      className="text-xs px-2.5 py-1 rounded-lg bg-white border border-slate-200 hover:border-brand-400 hover:text-brand-700"
                    >
                      {t('history_rerun_sim', { v: scenario.version })}
                    </button>
                  </>
                )}
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2 text-sm text-slate-600">
                {t('conversation_log', { n: selected.transcript.length })}
              </h3>
              <Stage
                scenario={scenario}
                transcript={selected.transcript}
                studentName={selected.runnerName}
                studentEmoji={selected.runnerType === 'simulated_student' ? '🤖' : '👤'}
              />
            </div>

            {selected.evaluation && (
              <>
                <EvaluationView evaluation={selected.evaluation} />
                <div className="bg-gradient-to-r from-brand-50 to-white border border-brand-200 rounded-xl p-4 flex items-center justify-between gap-3">
                  <div className="text-sm text-slate-700">
                    <div className="font-semibold">{t('history_refine_title')}</div>
                    <div className="text-xs text-slate-500">{t('history_refine_sub')}</div>
                  </div>
                  <RefineScenarioButton
                    scenario={scenario}
                    evaluations={[
                      {
                        runnerName: selected.runnerName,
                        runnerType: selected.runnerType,
                        evaluation: selected.evaluation,
                      },
                    ]}
                    onApplied={() => {
                      // 升级完场景后把老师弹到 Live tab，方便"立刻用新版再跑一遍"
                      onSwitchTab?.('live');
                    }}
                  />
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="text-center text-slate-400 py-20 bg-white rounded-xl border border-slate-200">
            {t('history_select_hint')}
          </div>
        )}
      </div>
    </div>
  );
}

// ───────────────────────── 评估报告展示 ─────────────────────────
function EvaluationView({ evaluation: e }: { evaluation: Evaluation }) {
  const { t } = useT();
  return (
    <div className="space-y-4">
      <div className="bg-gradient-to-br from-brand-50 to-white border border-brand-200 rounded-xl p-5">
        <div className="flex items-start gap-4">
          <div className="text-center">
            <div className="text-3xl font-bold text-brand-700">
              {e.studentPerformance.overallScore}
            </div>
            <div className="text-xs text-slate-500">{t('eval_overall_score')}</div>
          </div>
          <div className="flex-1 text-sm">
            <div className="font-semibold mb-1">{t('eval_verdict_title')}</div>
            <p className="text-slate-700">{e.overallVerdict}</p>
          </div>
        </div>
      </div>

      {/* 学生表现 */}
      <EvalCard title={t('eval_student_perf')}>
        <div className="grid grid-cols-2 gap-3 mb-3">
          {e.studentPerformance.rubricScores.map((r, i) => (
            <div key={i} className="border border-slate-200 rounded p-2">
              <div className="text-sm font-medium">{r.criterionName}</div>
              <div className="text-xs text-slate-600">
                {r.score}/{r.maxScore}
              </div>
              <ScoreBar value={r.score} max={r.maxScore} />
              <p className="text-xs text-slate-500 mt-1">{r.feedback}</p>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs font-semibold text-green-700 mb-1">
              {t('eval_strengths')}
            </div>
            <ul className="text-sm space-y-1">
              {e.studentPerformance.strengths.map((s, i) => (
                <li key={i}>• {s}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-xs font-semibold text-orange-700 mb-1">
              {t('eval_weaknesses')}
            </div>
            <ul className="text-sm space-y-1">
              {e.studentPerformance.weaknesses.map((s, i) => (
                <li key={i}>• {s}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-3 p-3 bg-slate-50 rounded text-sm">
          <div className="text-xs font-semibold text-slate-600 mb-1">
            {t('eval_feedback')}
          </div>
          <p className="prose-msg">{e.studentPerformance.actionableFeedback}</p>
        </div>
        {(e.studentPerformance.trapsTriggered.length > 0 ||
          e.studentPerformance.missedTraps.length > 0) && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold text-red-700 mb-1">
                {t('eval_traps_triggered')}
              </div>
              <ul className="text-xs space-y-0.5">
                {e.studentPerformance.trapsTriggered.map((x, i) => (
                  <li key={i}>• {x}</li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-600 mb-1">
                {t('eval_traps_missed')}
              </div>
              <ul className="text-xs space-y-0.5">
                {e.studentPerformance.missedTraps.map((x, i) => (
                  <li key={i}>• {x}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </EvalCard>

      {/* Agent 保真度 */}
      <EvalCard title={t('eval_fidelity')}>
        <div className="space-y-2">
          {e.agentFidelity.map((a, i) => (
            <div key={i} className="border border-slate-200 rounded p-3">
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">{a.agentName}</div>
                <ScoreBar value={a.score} max={10} />
              </div>
              <p className="text-xs text-slate-600 mt-1">{a.summary}</p>
              {a.issues.length > 0 && (
                <ul className="mt-2 text-xs space-y-1">
                  {a.issues.map((iss, j) => (
                    <li key={j} className="text-red-600">
                      [{iss.severity}] {iss.issue}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </EvalCard>

      {/* 幻觉 */}
      <EvalCard title={t('eval_hallucinations')} badge={e.hallucinations.length}>
        {e.hallucinations.length === 0 ? (
          <p className="text-sm text-green-700">{t('no_hallucinations')}</p>
        ) : (
          <ul className="space-y-2">
            {e.hallucinations.map((h, i) => (
              <li
                key={i}
                className={`text-sm p-2 rounded border-l-4 ${
                  h.severity === 'high'
                    ? 'border-red-500 bg-red-50'
                    : h.severity === 'medium'
                    ? 'border-orange-400 bg-orange-50'
                    : 'border-yellow-400 bg-yellow-50'
                }`}
              >
                <div className="font-medium">{h.agentId}</div>
                <div className="text-xs">{t('hallu_said', { claim: h.claim })}</div>
                <div className="text-xs text-slate-600 mt-1">{h.issue}</div>
                <div className="text-xs text-slate-500 mt-1">
                  {t('hallu_evidence', { ev: h.evidence })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </EvalCard>

      {/* 场景设计问题 */}
      <EvalCard title={t('eval_design_issues')} badge={e.scenarioDesignIssues.length}>
        {e.scenarioDesignIssues.length === 0 ? (
          <p className="text-sm text-green-700">{t('no_design_issues')}</p>
        ) : (
          <ul className="space-y-2">
            {e.scenarioDesignIssues.map((s, i) => (
              <li key={i} className="text-sm border border-slate-200 rounded p-2">
                <div>
                  <span className="text-xs bg-slate-100 px-1.5 py-0.5 rounded mr-1">
                    {s.type}
                  </span>
                  {s.description}
                </div>
                <div className="text-xs text-slate-600 mt-1">
                  {t('design_suggestion', { s: s.suggestion })}
                </div>
              </li>
            ))}
          </ul>
        )}
      </EvalCard>
    </div>
  );
}

function EvalCard({
  title,
  badge,
  children,
}: {
  title: string;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold mb-3 text-sm flex items-center gap-2">
        {title}
        {badge !== undefined && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full ${
              badge > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
            }`}
          >
            {badge}
          </span>
        )}
      </h3>
      {children}
    </div>
  );
}

