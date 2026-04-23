import { NextRequest, NextResponse } from 'next/server';
import { callLLMJson } from '@/lib/llm';
import { buildScenarioRefinementPrompt } from '@/lib/prompts';
import type { Evaluation, RefinementResponse, Scenario } from '@/lib/types';
import type { Locale } from '@/lib/i18n';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface RefineRequest {
  scenario: Scenario;
  evaluations: Array<{
    runnerName: string;
    runnerType: 'human_student' | 'simulated_student';
    evaluation: Evaluation;
  }>;
  locale?: Locale;
  apiKey?: string;
}

/**
 * POST /api/refine
 * 拿当前场景 + 一次或多次评估回来，产出一个 scenarioPatch 让老师"一键升级场景"。
 * 这就闭合了"跑 → 评估 → 改 → 再跑"的教学迭代环。
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RefineRequest;
    const { scenario, evaluations, locale, apiKey } = body;
    const loc: Locale = locale === 'en' ? 'en' : 'zh';

    if (!scenario || !Array.isArray(evaluations) || evaluations.length === 0) {
      return NextResponse.json(
        { error: 'Missing scenario or evaluations' },
        { status: 400 }
      );
    }

    const prompt = buildScenarioRefinementPrompt(scenario, evaluations, loc);

    const result = await callLLMJson<RefinementResponse>({
      system:
        loc === 'en'
          ? 'You are a pedagogy-specialist that outputs strict valid JSON. Base every change on concrete evidence from the provided evaluations.'
          : '你是教学法专家，输出严格合法的 JSON。每个改动都必须有评估证据支撑。',
      user: prompt,
      temperature: 0.4,
      // ⚠️ scenarioPatch 经常包括完整的 agents[] + rubric[] + traps[] + context
      // + changeSummary 长篇 + 一堆 bulletChanges。4096 tokens 根本不够，模型
      // 写到一半就被截断 → JSON 不合法 → extractJson 抛错 → 老师看到"解析失败"。
      // Gemini 2.5 flash 输出上限 ~64k，给 12000 足够跑完大多数真实场景。
      maxTokens: 12000,
      apiKey,
    });

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[api/refine] error:', err);
    return NextResponse.json(
      { error: err?.message || 'Refine failed' },
      { status: 500 }
    );
  }
}
