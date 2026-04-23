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
export const maxDuration = 300; // 模拟一个完整会话可能要跑很久

interface SimulateRequest {
  scenario: Scenario;
  simulatedStudentId: string;
  locale?: Locale;
  apiKey?: string;
}

/**
 * 稳定的结束原因枚举——给 UI 用（按老师当前语言 t() 渲染），老 session 记录里也能被兼容。
 * endReason (string) 仍然返回以兼容旧客户端和旧会话；新客户端优先看 endReasonCode。
 */
export type EndReasonCode =
  | 'normal'
  | 'director_ended'
  | 'student_ended'
  | 'agent_not_found'
  | 'max_turns';

interface SimulateResponse {
  transcript: Message[];
  endReason: string;
  endReasonCode: EndReasonCode;
}

/**
 * POST /api/simulate
 * 让一个模拟学生完整跑完场景，返回 transcript
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as SimulateRequest;
    const { scenario, simulatedStudentId, locale, apiKey } = body;
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

    const transcript: Message[] = [];
    let endReason = loc === 'en' ? 'Ended normally' : '正常结束';
    let endReasonCode: EndReasonCode = 'normal';

    // 开场白（如果有）
    if (scenario.openingBeat) {
      transcript.push({
        id: `msg_${nanoid(8)}`,
        speakerId: 'narrator',
        speakerName: loc === 'en' ? 'Narrator' : '旁白',
        content: scenario.openingBeat,
        timestamp: Date.now(),
      });
    }

    // 主循环
    for (let turn = 0; turn < scenario.maxTurns; turn++) {
      // Director 决定下一个
      let nextId: string;
      const agents = scenario.agents ?? [];
      const lastMsg = transcript[transcript.length - 1];
      const lastIsNarratorOrEmpty = !lastMsg || lastMsg.speakerId === 'narrator';
      const lastIsStudent = lastMsg?.speakerId === 'student';

      if (lastIsNarratorOrEmpty) {
        // 开场后让第一个 agent 发言
        nextId = agents[0]?.id || 'STUDENT';
      } else if (lastIsStudent && agents.length > 0) {
        // 学生刚说完 → 必须 NPC 回应
        try {
          const directorPrompt =
            buildDirectorPrompt(scenario, transcript, agents.map((a) => a.id), loc) +
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
        try {
          const directorPrompt = buildDirectorPrompt(
            scenario,
            transcript,
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
      }

      if (nextId === 'END') {
        endReason = loc === 'en' ? 'Director decided to end' : 'director 判定结束';
        endReasonCode = 'director_ended';
        break;
      }

      if (nextId === 'STUDENT') {
        // 让模拟学生说话
        const studentSystem = buildSimulatedStudentPrompt(persona, scenario, loc);
        const recentLines = transcript
          .slice(-10)
          .map((m) => `[${m.speakerName}]: ${m.content}`)
          .join('\n');
        const studentUser =
          loc === 'en'
            ? `# Recent conversation
${recentLines}

# Task
It's now your turn (the student, playing ${scenario.studentRole.name}) to speak. Respond in your persona style. Short and natural.
If you think the scenario should end, say [END]`
            : `# 最近对话
${recentLines}

# 任务
现在轮到你（学生，扮演 ${scenario.studentRole.name}）说话。按你的人格风格回应。简短自然。
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
          endReason = loc === 'en' ? 'Student ended conversation' : '学生主动结束';
          endReasonCode = 'student_ended';
          break;
        }

        transcript.push({
          id: `msg_${nanoid(8)}`,
          speakerId: 'student',
          speakerName:
            loc === 'en'
              ? `${persona.name} (as ${scenario.studentRole.name})`
              : `${persona.name} (扮演${scenario.studentRole.name})`,
          content: clean,
          timestamp: Date.now(),
        });
        continue;
      }

      // Agent 发言
      const agent = (scenario.agents ?? []).find((a) => a.id === nextId);
      if (!agent) {
        // 找不到就结束防死循环
        endReason = loc === 'en' ? 'agent not found' : 'agent 不存在';
        endReasonCode = 'agent_not_found';
        break;
      }

      const otherAgents = (scenario.agents ?? []).filter((a) => a.id !== agent.id);
      const agentSystem = buildAgentSystemPrompt(agent, scenario, otherAgents, loc);
      const recentLines = transcript
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

      transcript.push({
        id: `msg_${nanoid(8)}`,
        speakerId: agent.id,
        speakerName: agent.name,
        content: content.trim(),
        timestamp: Date.now(),
      });
    }

    if (transcript.length >= scenario.maxTurns) {
      endReason = loc === 'en' ? 'Max turns reached' : '达到最大回合数';
      endReasonCode = 'max_turns';
    }

    return NextResponse.json<SimulateResponse>({ transcript, endReason, endReasonCode });
  } catch (err: any) {
    console.error('[api/simulate] error:', err);
    return NextResponse.json({ error: err?.message || 'Simulate failed' }, { status: 500 });
  }
}
