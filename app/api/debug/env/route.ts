import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * 临时诊断端点：访问 /api/debug/env 看 GOOGLE_GENERATIVE_AI_API_KEY 到底有没有
 * 被 Vercel 注入到服务端运行时。
 *
 * 不返回 key 本身，只返回：
 *   - 是否存在
 *   - 长度
 *   - 前 4 位和后 4 位（用于辨认是哪个 key，但贴出来也不会泄漏完整 key）
 *
 * 验证完务必删掉这个文件再 push。
 */
export async function GET() {
  const key = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const provider = process.env.LLM_PROVIDER;
  const model = process.env.GOOGLE_MODEL;

  return NextResponse.json({
    has_GOOGLE_GENERATIVE_AI_API_KEY: !!key,
    key_length: key ? key.length : 0,
    key_prefix: key ? key.slice(0, 4) : null,
    key_suffix: key ? key.slice(-4) : null,
    LLM_PROVIDER: provider || '(unset, will default to google)',
    GOOGLE_MODEL: model || '(unset, will default to gemini-2.5-flash)',
    // Vercel 系统注入的变量，方便确认是哪个部署在响应
    vercel_env: process.env.VERCEL_ENV || null,
    vercel_url: process.env.VERCEL_URL || null,
    vercel_git_commit_sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null,
    node_env: process.env.NODE_ENV || null,
  });
}
