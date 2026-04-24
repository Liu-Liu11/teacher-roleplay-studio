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

    // 老师切语言后的痛点：即便 system prompt 指定了输出语言，模型受前面聊天历史的
    // 语言惯性影响，仍可能继续用旧语言回复（中文聊了 10 轮，切到 en 后 AI 还是中文）。
    // 每一轮都在 user prompt 末尾重申一次"本次回复必须用 X 语言"，模型会更稳。
    const languageLock =
      loc === 'en'
        ? '\n\n⚠️ LANGUAGE FOR THIS REPLY: Respond entirely in English, including the "reply" field and any dialogue, narration, or scenarioPatch text fields. The prior conversation may be in Chinese — IGNORE that and switch to English now. The teacher has set their UI to English.'
        : '\n\n⚠️ 本轮回复语言：请完全用中文回复，包括 "reply" 字段以及任何对话/旁白/scenarioPatch 文本字段。即使前面的对话是英文，也请从本轮开始改用中文。老师已将界面切换为中文。';

    const userPrompt = `${historyText ? `${pastHeader}\n${historyText}\n\n` : ''}${saidHeader}
${userMessage}

${instr}${languageLock}`;

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
