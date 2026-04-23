import { NextRequest, NextResponse } from 'next/server';
import { callLLMJson } from '@/lib/llm';
import { buildEvaluatorPrompt } from '@/lib/prompts';
import type { Evaluation, Message, Scenario } from '@/lib/types';
import type { Locale } from '@/lib/i18n';

export const runtime = 'nodejs';
export const maxDuration = 120;

interface EvaluateRequest {
  scenario: Scenario;
  sessionId: string;
  transcript: Message[];
  runnerType: 'human_student' | 'simulated_student';
  runnerName: string;
  locale?: Locale;
  apiKey?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as EvaluateRequest;
    const { scenario, sessionId, transcript, runnerType, runnerName, locale, apiKey } = body;
    const loc: Locale = locale === 'en' ? 'en' : 'zh';

    const prompt = buildEvaluatorPrompt(scenario, transcript, runnerType, runnerName, loc);

    const rawEval = await callLLMJson<Omit<Evaluation, 'sessionId' | 'generatedAt'>>({
      system:
        loc === 'en'
          ? 'You are an extremely strict, objective pedagogy evaluator. Your output MUST be strictly valid, parsable JSON. Use temperature 0.2.'
          : '你是一个极其严格、客观的教学评估专家。你的输出必须是严格的、可解析的 JSON。使用温度 0.2。',
      user: prompt,
      temperature: 0.2,
      // ⚠️ 评估输出体量 = agentFidelity(每 NPC 一个块) + hallucinations(逐条) +
      // studentPerformance.rubricScores(每个维度一块) + strengths/weaknesses/feedback
      // + scenarioDesignIssues + overallVerdict。多 NPC + 多 rubric + 长 transcript
      // 的真实场景，6000 tokens 经常在 hallucinations 或 actionableFeedback 半路被截，
      // 导致 JSON 不闭合。12000 给足一倍预算。
      maxTokens: 12000,
      apiKey,
    });

    const evaluation: Evaluation = {
      ...rawEval,
      sessionId,
      generatedAt: Date.now(),
    };

    return NextResponse.json(evaluation);
  } catch (err: any) {
    console.error('[api/evaluate] error:', err);
    return NextResponse.json({ error: err?.message || 'Evaluate failed' }, { status: 500 });
  }
}
