import { NextRequest, NextResponse } from 'next/server';
import { generateSceneImage, generateAvatarImage } from '@/lib/gemini-media';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/generate/image
 * body: {
 *   kind: 'scene' | 'avatar',
 *   prompt: string,                  // scene 的描述 / avatar 的 persona
 *   name?: string,                   // avatar 才需要
 *   apiKey: string
 * }
 * return: { dataUrl, mimeType }
 */
export async function POST(req: NextRequest) {
  try {
    const { kind, prompt, name, apiKey } = await req.json();
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing apiKey' }, { status: 400 });
    }
    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 });
    }

    const out =
      kind === 'avatar'
        ? await generateAvatarImage(name || 'Character', prompt, apiKey)
        : await generateSceneImage(prompt, apiKey);

    return NextResponse.json(out);
  } catch (err: any) {
    console.error('[api/generate/image] error:', err);
    return NextResponse.json(
      { error: err?.message || 'image generation failed' },
      { status: 500 }
    );
  }
}
