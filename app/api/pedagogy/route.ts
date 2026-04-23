import { NextRequest, NextResponse } from 'next/server';
import { callLLMJson } from '@/lib/llm';
import { buildPedagogySystemPrompt } from '@/lib/prompts';
import type { PedagogyResponse, Scenario } from '@/lib/types';
import type { Locale } from '@/lib/i18n';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/pedagogy
 * body: { scenario: Partial<Scenario>, userMessage: string, chatHistory: Array<{role,content}> }
 * return: PedagogyResponse
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { scenario, userMessage, chatHistory, locale, apiKey } = body as {
      scenario: Partial<Scenario>;
      userMessage: string;
      chatHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
      locale?: Locale;
      apiKey?: string;
    };

    const loc: Locale = locale === 'en' ? 'en' : 'zh';
    const system = buildPedagogySystemPrompt(scenario, loc);

    const teacherLabel = loc === 'en' ? 'Teacher' : '老师';
    const selfLabel =
      loc === 'en' ? 'You (Pedagogy Specialist)' : '你（教学法专家）';
    const pastHeader = loc === 'en' ? '# Prior conversation' : '# 过往对话';
    const saidHeader = loc === 'en' ? '# Teacher just said' : '# 老师刚刚说';
    const instr =
      loc === 'en'
        ? 'Please output the JSON response per the spec above.'
        : '请按要求输出 JSON 响应。';

    const historyText = (chatHistory || [])
      .map((m) => `${m.role === 'user' ? teacherLabel : selfLabel}: ${m.content}`)
      .join('\n\n');

    const userPrompt = `${historyText ? `${pastHeader}\n${historyText}\n\n` : ''}${saidHeader}
${userMessage}

${instr}`;

    const result = await callLLMJson<PedagogyResponse>({
      system,
      user: userPrompt,
      temperature: 0.7,
      maxTokens: 4096,
      apiKey,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[api/pedagogy] error:', err);
    return NextResponse.json(
      { error: err?.message || 'Pedagogy specialist call failed' },
      { status: 500 }
    );
  }
}
