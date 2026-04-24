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

    // 老师切语言后的痛点：即便 system prompt 指定了输出语言，模型读到一大段旧语言的
    // 聊天历史后会被"语言惯性"带跑（英文聊了 10 轮，切到 zh 后 AI 还是英文回）。
    // 单在末尾加一句不够——历史太长时末尾指令被稀释。改成"三明治"结构：历史**之前**
    // 先声明本轮语言并明示"忽略历史语言"，历史**之后**再重申一次。
    const languageLockTop =
      loc === 'en'
        ? '⚠️ OUTPUT LANGUAGE FOR THIS REPLY IS ENGLISH.\nThe teacher has switched their UI to English. Even if the conversation history below is mostly in Chinese, respond ENTIRELY in English — the "reply" field, any dialogue, narration, feedback, and every text field inside scenarioPatch. Do NOT mirror the language of the history. Do NOT emit any Chinese characters in your output.'
        : '⚠️ 本轮输出语言为中文（简体中文）。\n老师已将界面切换为中文。即使下方的对话历史大部分是英文，也必须从本轮开始完全使用中文回复——包括 "reply" 字段、任何对话/旁白/反馈，以及 scenarioPatch 内部所有文本字段。不要跟随历史的语言。不要在输出中夹杂英文句子。';

    const languageLockBottom =
      loc === 'en'
        ? '(Final reminder: reply in English only, regardless of what language the history is in.)'
        : '（最后再强调一次：无论历史用的什么语言，本轮只能用中文回复。）';

    const userPrompt = `${languageLockTop}

${historyText ? `${pastHeader}\n${historyText}\n\n` : ''}${saidHeader}
${userMessage}

${instr}

${languageLockBottom}`;

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
