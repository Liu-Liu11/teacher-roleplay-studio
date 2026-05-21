import { NextRequest, NextResponse } from 'next/server';
import { callLLM, callLLMJson } from '@/lib/llm';
import {
  buildAgentSystemPrompt,
  buildDirectorPrompt,
  buildSimulatedStudentPrompt,
} from '@/lib/prompts';
import { getSimulatedStudent } from '@/lib/simulated-students';
import type { Message, Scenario } from '@/lib/types';
import type { Locale } from '@/lib/i18n';
import { nanoid } from 'nanoid';

export const runtime = 'nodejs';
// 单步模式：每次请求只跑一回合 → 永远不会逼近 Vercel 函数时长上限
// （Hobby plan 60s）。客户端负责 loop 多次调用直到 END / maxTurns。
export const maxDuration = 60;

interface SimulateRequest {
  scenario: Scenario;
  /** 客户端累积到目前为止的 transcript（不含本轮要生成的那一条） */
  transcript: Message[];
  simulatedStudentId: string;
  locale?: Locale;
  apiKey?: string;
}

/**
 * 稳定的结束原因枚举——给 UI 用（按老师当前语言 t() 渲染），老 session 记录里也能被兼容。
 */
export type EndReasonCode =
  | 'normal'
  | 'director_ended'
  | 'student_ended'
  | 'agent_not_found'
  | 'max_turns';

interface SimulateStepResponse {
  next: 'AGENT' | 'STUDENT' | 'END';
  /** AGENT/STUDENT 时返回本轮生成的消息；END 时为空 */
  message?: Message;
  /** END 时返回 */
  endReason?: string;
  endReasonCode?: EndReasonCode;
}

/**
 * POST /api/simulate
 *
 * **单步模式（v2，2026-05 起）**：一次请求只生成一条消息。
 * 客户端持有 transcript，循环调用直到 next === 'END'。
 *
 * 为什么这么改：旧版一次请求里跑完整 N 回合循环，Vercel Hobby 60s 函数上限 +
 * 多 NPC + 多 LLM 调用 → 频繁超时（"Server timeout. Try a shorter transcript
 * or fewer NPCs."）。单步模式每次只需 ~5-15s。
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SimulateRequest;
    const { scenario, transcript, simulatedStudentId, locale, apiKey } = body;
    const loc: Locale = locale === 'en' ? 'en' : 'zh';

    const persona = getSimulatedStudent(simulatedStudentId, loc);
    if (!persona) {
      return NextResponse.json(
        {
          error:
            loc === 'en'
              ? 'Simulated student persona not found'
              : '模拟学生人格不存在',
        },
        { status: 400 }
      );
    }

    // 防御：transcript 默认为空数组
    const tr: Message[] = Array.isArray(transcript) ? transcript : [];

    // 达到 maxTurns（不算 narrator）→ END
    const nonNarratorTurns = tr.filter((m) => m.speakerId !== 'narrator').length;
    if (nonNarratorTurns >= scenario.maxTurns) {
      return NextResponse.json<SimulateStepResponse>({
        next: 'END',
        endReason: loc === 'en' ? 'Max turns reached' : '达到最大回合数',
        endReasonCode: 'max_turns',
      });
    }

    // 1) Director 决定下一个发言者
    const agents = scenario.agents ?? [];
    const lastMsg = tr[tr.length - 1];
    const lastIsNarratorOrEmpty = !lastMsg || lastMsg.speakerId === 'narrator';
    const lastIsStudent = lastMsg?.speakerId === 'student';

    let nextId: string;

    if (lastIsNarratorOrEmpty && agents.length > 0) {
      // 开场（只有 narrator 或空）→ 第一个 NPC 直接发言
      nextId = agents[0].id;
    } else if (lastIsNarratorOrEmpty) {
      // 没有 NPC，开场让学生说
      nextId = 'STUDENT';
    } else if (lastIsStudent && agents.length > 0) {
      // 学生刚说完 → 硬规则：必须 NPC
      try {
        const directorPrompt =
          buildDirectorPrompt(scenario, tr, agents.map((a) => a.id), loc) +
          (loc === 'en'
            ? '\n\n# HARD RULE\nThe student just spoke. You MUST pick an NPC agent id (never STUDENT, never END). Pick whichever NPC would most naturally respond.'
            : '\n\n# 硬性规则\n学生刚刚说完话。你必须选一个 NPC 的 agent id（绝不能返回 STUDENT 或 END）。选最自然会回应的那个 NPC。');
        const decision = await callLLMJson<{ next: string; reason: string }>({
          system:
            loc === 'en'
              ? 'You are a director that strictly outputs JSON.'
              : '你是严格按JSON输出的导演。',
          user: directorPrompt,
          temperature: 0.3,
          maxTokens: 200,
          apiKey,
        });
        nextId =
          decision.next === 'STUDENT' || decision.next === 'END'
            ? agents[0].id
            : decision.next;
      } catch {
        nextId = agents[0].id;
      }
    } else {
      // 上一句是 NPC → 自由 director
      try {
        const directorPrompt = buildDirectorPrompt(
          scenario,
          tr,
          agents.map((a) => a.id),
          loc
        );
        const decision = await callLLMJson<{ next: string; reason: string }>({
          system:
            loc === 'en'
              ? 'You are a director that strictly outputs JSON.'
              : '你是严格按JSON输出的导演。',
          user: directorPrompt,
          temperature: 0.3,
          maxTokens: 200,
          apiKey,
        });
        nextId = decision.next;
      } catch {
        nextId = 'STUDENT';
      }

      // 硬性兜底（同 /api/run）：多 NPC 场景里至少让 2 个不同 NPC 完成一来一回再切学生。
      // 仅在自由 director 分支里启用——开场和学生刚说完的分支已经各有硬规则。
      if (nextId === 'STUDENT' && agents.length >= 2) {
        let consecutiveNpcSinceStudent = 0;
        let lastNpcId: string | undefined;
        for (let i = tr.length - 1; i >= 0; i--) {
          const sp = tr[i].speakerId;
          if (sp === 'student') break;
          if (sp && sp !== 'narrator') {
            consecutiveNpcSinceStudent++;
            if (!lastNpcId) lastNpcId = sp;
          }
        }
        if (consecutiveNpcSinceStudent < 2) {
          const candidate =
            agents.find((a) => a.id !== lastNpcId) ?? agents[0];
          if (candidate) nextId = candidate.id;
        }
      }
    }

    // 2) Director 让结束 → END
    if (nextId === 'END') {
      return NextResponse.json<SimulateStepResponse>({
        next: 'END',
        endReason: loc === 'en' ? 'Director decided to end' : 'director 判定结束',
        endReasonCode: 'director_ended',
      });
    }

    // 3) STUDENT → 让模拟学生发言
    if (nextId === 'STUDENT') {
      const studentSystem = buildSimulatedStudentPrompt(persona, scenario, loc);
      const recentLines = tr
        .slice(-10)
        .map((m) => `[${m.speakerName}]: ${m.content}`)
        .join('\n');
      const studentUser =
        loc === 'en'
          ? `# Recent conversation
${recentLines}

# Task
It's now your turn (the student, playing ${scenario.studentRole?.name ?? 'the student'}) to speak. Respond in your persona style. Short and natural.
If you think the scenario should end, say [END]`
          : `# 最近对话
${recentLines}

# 任务
现在轮到你（学生，扮演 ${scenario.studentRole?.name ?? '学生'}）说话。按你的人格风格回应。简短自然。
如果你觉得场景应该结束了，就说 [END]`;

      const content = await callLLM({
        system: studentSystem,
        user: studentUser,
        temperature: 0.8,
        maxTokens: 300,
        apiKey,
      });

      const clean = content.trim();
      if (clean.includes('[END]')) {
        return NextResponse.json<SimulateStepResponse>({
          next: 'END',
          endReason: loc === 'en' ? 'Student ended conversation' : '学生主动结束',
          endReasonCode: 'student_ended',
        });
      }

      const msg: Message = {
        id: `msg_${nanoid(8)}`,
        speakerId: 'student',
        speakerName:
          loc === 'en'
            ? `${persona.name} (as ${scenario.studentRole?.name ?? 'student'})`
            : `${persona.name} (扮演${scenario.studentRole?.name ?? '学生'})`,
        content: clean,
        timestamp: Date.now(),
      };
      return NextResponse.json<SimulateStepResponse>({ next: 'STUDENT', message: msg });
    }

    // 4) AGENT → 让该 agent 发言
    // 兜底：find 不到就退回 agents[0]，跟 /api/run 一致
    const agent =
      (scenario.agents ?? []).find((a) => a.id === nextId) ??
      (scenario.agents ?? [])[0];
    if (!agent) {
      return NextResponse.json<SimulateStepResponse>({
        next: 'END',
        endReason: loc === 'en' ? 'No agents in scenario' : '场景没有 NPC',
        endReasonCode: 'agent_not_found',
      });
    }

    const otherAgents = (scenario.agents ?? []).filter((a) => a.id !== agent.id);
    const agentSystem = buildAgentSystemPrompt(agent, scenario, otherAgents, loc);
    const recentLines = tr
      .slice(-10)
      .map((m) => `[${m.speakerName}]: ${m.content}`)
      .join('\n');
    const agentUser =
      loc === 'en'
        ? `# Recent conversation
${recentLines || '(scenario start)'}

# Task
It's your turn (${agent.name}) to speak. Short and natural, no more than 3 sentences.`
        : `# 最近对话
${recentLines || '(场景开始)'}

# 任务
现在轮到你（${agent.name}）说话。简短自然，不超过 3 句。`;

    const content = await callLLM({
      system: agentSystem,
      user: agentUser,
      temperature: 0.8,
      maxTokens: 500,
      apiKey,
    });

    const msg: Message = {
      id: `msg_${nanoid(8)}`,
      speakerId: agent.id,
      speakerName: agent.name,
      content: content.trim(),
      timestamp: Date.now(),
    };
    return NextResponse.json<SimulateStepResponse>({ next: 'AGENT', message: msg });
  } catch (err: any) {
    console.error('[api/simulate] error:', err);
    return NextResponse.json({ error: err?.message || 'Simulate failed' }, { status: 500 });
  }
}
