import { NextRequest, NextResponse } from 'next/server';
import { callLLM, callLLMJson } from '@/lib/llm';
import { buildAgentSystemPrompt, buildDirectorPrompt } from '@/lib/prompts';
import type { Message, Scenario } from '@/lib/types';
import type { Locale } from '@/lib/i18n';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface RunRequest {
  scenario: Scenario;
  transcript: Message[];
  /** 如果指定 forceAgentId，就让这个 agent 发言，不再通过 director 决策 */
  forceAgentId?: string;
  locale?: Locale;
  apiKey?: string;
}

interface RunResponse {
  next: 'AGENT' | 'STUDENT' | 'END';
  agentId?: string;
  agentName?: string;
  content?: string;
  reason?: string;
}

/**
 * POST /api/run
 * 推进一步场景：先由 director 决定下一个发言者，然后让该 agent 生成一句话。
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RunRequest;
    const { scenario, transcript, forceAgentId, locale, apiKey } = body;
    const loc: Locale = locale === 'en' ? 'en' : 'zh';

    // 1) Director 决定下一个发言者
    let nextId: string;
    let reason = '';

    const agents = scenario.agents ?? [];
    const lastMsg = transcript[transcript.length - 1];
    const lastIsNarratorOrEmpty = !lastMsg || lastMsg.speakerId === 'narrator';
    const lastIsStudent = lastMsg?.speakerId === 'student';

    if (forceAgentId) {
      nextId = forceAgentId;
      reason = 'forced';
    } else if (transcript.length >= scenario.maxTurns) {
      nextId = 'END';
      reason = loc === 'en' ? 'Reached max turns' : '达到最大回合数';
    } else if (lastIsNarratorOrEmpty && agents.length > 0) {
      // 开场（只有旁白或空）→ 直接让第一个 NPC 开口，不问 director
      nextId = agents[0].id;
      reason = loc === 'en' ? 'Opening — first NPC speaks' : '开场，第一个 NPC 发言';
    } else if (lastIsStudent && agents.length > 0) {
      // 学生刚说完 → 必须由 NPC 回应；用 director 选"哪个 NPC"，但强制不许返回 STUDENT/END
      try {
        const directorPrompt =
          buildDirectorPrompt(scenario, transcript, agents.map((a) => a.id), loc) +
          (loc === 'en'
            ? '\n\n# HARD RULE\nThe student just spoke. You MUST pick an NPC agent id (never STUDENT, never END). Pick whichever NPC would most naturally respond.'
            : '\n\n# 硬性规则\n学生刚刚说完话。你必须选一个 NPC 的 agent id（绝不能返回 STUDENT 或 END）。选最自然会回应的那个 NPC。');
        const decision = await callLLMJson<{ next: string; reason: string }>({
          system:
            loc === 'en'
              ? 'You are a director assistant that strictly outputs decisions as JSON.'
              : '你是一个严格按JSON格式输出决策的导演助手。',
          user: directorPrompt,
          temperature: 0.3,
          maxTokens: 200,
          apiKey,
        });
        nextId =
          decision.next === 'STUDENT' || decision.next === 'END'
            ? agents[0].id
            : decision.next;
        reason = decision.reason;
      } catch {
        nextId = agents[0].id;
        reason = loc === 'en' ? 'Director failed — first NPC replies' : 'director 失败，第一个 NPC 回复';
      }
    } else {
      const directorPrompt = buildDirectorPrompt(
        scenario,
        transcript,
        agents.map((a) => a.id),
        loc
      );
      try {
        const decision = await callLLMJson<{ next: string; reason: string }>({
          system:
            loc === 'en'
              ? 'You are a director assistant that strictly outputs decisions as JSON.'
              : '你是一个严格按JSON格式输出决策的导演助手。',
          user: directorPrompt,
          temperature: 0.3,
          maxTokens: 200,
          apiKey,
        });
        nextId = decision.next;
        reason = decision.reason;
      } catch {
        // 失败时的保守策略：让学生说
        nextId = 'STUDENT';
        reason =
          loc === 'en'
            ? 'Director decision failed — handing off to student'
            : 'director 决策失败，交给学生';
      }
    }

    if (nextId === 'END') {
      return NextResponse.json<RunResponse>({ next: 'END', reason });
    }
    if (nextId === 'STUDENT') {
      return NextResponse.json<RunResponse>({ next: 'STUDENT', reason });
    }

    // 2) 找到对应 agent
    const agent = (scenario.agents ?? []).find((a) => a.id === nextId);
    if (!agent) {
      return NextResponse.json<RunResponse>({
        next: 'STUDENT',
        reason:
          loc === 'en'
            ? `Agent id=${nextId} not found — handing to student`
            : `未找到 agent id=${nextId}，交给学生`,
      });
    }

    // 3) 让该 agent 生成一句话
    const otherAgents = (scenario.agents ?? []).filter((a) => a.id !== agent.id);
    const agentSystem = buildAgentSystemPrompt(agent, scenario, otherAgents, loc);

    const recentLines = transcript
      .map((m) => `[${m.speakerName}]: ${m.content}`)
      .join('\n');

    const agentUser =
      loc === 'en'
        ? `# Conversation so far
${recentLines || '(scenario just started)'}

# Task
It is now your turn (${agent.name}) to speak. Based on your persona, knowledge boundary, and hidden goals, produce your line for this turn.

Remember:
- Short and natural (1-3 sentences)
- Never reveal things you shouldn't know
- Don't volunteer help to the student (let them find out)
- Just speak — no quotes, no name prefix`
        : `# 到目前为止的对话
${recentLines || '(场景刚开始)'}

# 任务
现在轮到你（${agent.name}）说话。基于你的人设、知识边界和隐藏动机，生成你这一轮要说的话。

记住：
- 简短自然（1-3 句）
- 不要透露不该知道的信息
- 不要主动帮学生（让他们自己发现）
- 直接说话，不要加引号或前缀`;

    const content = await callLLM({
      system: agentSystem,
      user: agentUser,
      temperature: 0.8,
      maxTokens: 500,
      apiKey,
    });

    return NextResponse.json<RunResponse>({
      next: 'AGENT',
      agentId: agent.id,
      agentName: agent.name,
      content: content.trim(),
      reason,
    });
  } catch (err: any) {
    console.error('[api/run] error:', err);
    return NextResponse.json({ error: err?.message || 'Run failed' }, { status: 500 });
  }
}
