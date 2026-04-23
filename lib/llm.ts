import './proxy-init'; // 必须最先执行：给 undici 装全局代理（本地开发用）
import { anthropic, createAnthropic } from '@ai-sdk/anthropic';
import { google, createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, type LanguageModelV1 } from 'ai';

type Provider = 'anthropic' | 'google';

const PROVIDER: Provider = (process.env.LLM_PROVIDER as Provider) || 'google';
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-6';
const GOOGLE_MODEL = process.env.GOOGLE_MODEL || 'gemini-2.5-flash';

/**
 * 根据 provider + 用户 apiKey 构建模型。
 * - 用户在 UI 里填的 apiKey 优先
 * - 其次使用 env var（本地开发方便）
 * - 都没有就抛错
 */
function getModel(apiKey?: string): LanguageModelV1 {
  if (PROVIDER === 'google') {
    const key = apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) {
      throw new Error(
        'Missing Gemini API key. Please set it in the app (Settings ⚙) or configure GOOGLE_GENERATIVE_AI_API_KEY env var.'
      );
    }
    const client = apiKey ? createGoogleGenerativeAI({ apiKey }) : google;
    return client(GOOGLE_MODEL) as unknown as LanguageModelV1;
  }
  const key = apiKey || process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      'Missing Anthropic API key. Please set it in the app (Settings ⚙) or configure ANTHROPIC_API_KEY env var.'
    );
  }
  const client = apiKey ? createAnthropic({ apiKey }) : anthropic;
  return client(ANTHROPIC_MODEL) as unknown as LanguageModelV1;
}

export interface LLMCallOptions {
  system: string;
  user: string;
  temperature?: number;
  maxTokens?: number;
  /** 用户在 UI 里填的 API key，优先使用它而不是 env var */
  apiKey?: string;
}

export async function callLLM(opts: LLMCallOptions): Promise<string> {
  const { system, user, temperature = 0.7, maxTokens = 4096, apiKey } = opts;
  const { text } = await generateText({
    model: getModel(apiKey),
    system,
    prompt: user,
    temperature,
    maxTokens,
  });
  return text;
}

/**
 * 判断模型输出是否被 token 上限截断了。
 * 典型特征：非空、没有闭合大括号，或者字符串/对象/数组明显没收尾。
 */
function looksTruncated(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  // 没有闭合的 } —— 大概率被截断
  const opens = (t.match(/\{/g) || []).length;
  const closes = (t.match(/\}/g) || []).length;
  if (opens > closes) return true;
  // 最后一个有效字符不是 } 或 ] 或 ``` ——也常见于截断
  const lastChar = t[t.length - 1];
  if (lastChar !== '}' && lastChar !== ']' && lastChar !== '`') return true;
  return false;
}

/**
 * 从可能带 markdown 代码块的字符串中抽出 JSON 对象
 * LLM 偶尔会包一层 ```json ... ``` 或加前后缀
 */
export function extractJson<T = unknown>(text: string): T {
  const trimmed = text.trim();

  try {
    return JSON.parse(trimmed) as T;
  } catch {}

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) {
    try {
      return JSON.parse(fenceMatch[1]) as T;
    } catch {}
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = trimmed.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(candidate) as T;
    } catch {}
  }

  // 给诊断用：看起来被截断了？（maxTokens 不够是最常见根因）
  const truncated = looksTruncated(text);
  const head = text.slice(0, 300);
  const tail = text.length > 600 ? `\n…[truncated ${text.length - 600} chars]…\n${text.slice(-300)}` : '';
  const hint = truncated
    ? ' (response appears to be cut off — likely hit the maxTokens limit; try again or increase maxTokens)'
    : '';
  throw new Error(`Could not parse JSON from LLM response${hint}:\n${head}${tail}`);
}

export async function callLLMJson<T = unknown>(opts: LLMCallOptions): Promise<T> {
  const text = await callLLM(opts);
  try {
    return extractJson<T>(text);
  } catch (firstErr) {
    // ⚠️ 关键修复：第一次失败大概率是 maxTokens 截断。retry 时把 maxTokens 至少加倍，
    //   否则同样的预算又会在同一位置被截断，retry 等于白跑。
    const wasTruncated = looksTruncated(text);
    const baseMax = opts.maxTokens ?? 4096;
    const retryMax = wasTruncated ? Math.min(baseMax * 2, 24000) : baseMax;

    try {
      const retryText = await callLLM({
        ...opts,
        maxTokens: retryMax,
        user: `${opts.user}\n\nIMPORTANT: Your previous output could not be parsed (it may have been cut off mid-JSON). Output ONLY a single valid, **complete** JSON object — no markdown, no prefix, no suffix, and make sure every { [ " is properly closed.`,
      });
      return extractJson<T>(retryText);
    } catch (retryErr: any) {
      // 两次都失败就把第一次的错误一起报出来（对诊断更有用）
      throw new Error(
        `${retryErr?.message || 'LLM retry failed'}\n[first attempt error: ${(firstErr as any)?.message || firstErr}]`
      );
    }
  }
}

export function getProviderInfo() {
  return {
    provider: PROVIDER,
    model: PROVIDER === 'google' ? GOOGLE_MODEL : ANTHROPIC_MODEL,
  };
}
