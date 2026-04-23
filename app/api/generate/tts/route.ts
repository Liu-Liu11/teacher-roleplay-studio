import { NextRequest, NextResponse } from 'next/server';
import { generateSpeech, pickVoiceFor } from '@/lib/gemini-media';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * POST /api/generate/tts
 * body: { text: string, agentId?: string, voiceName?: string, apiKey: string }
 * return: { dataUrl, mimeType }
 */
export async function POST(req: NextRequest) {
  try {
    const { text, agentId, voiceName, apiKey } = await req.json();
    if (!apiKey) {
      return NextResponse.json({ error: 'Missing apiKey' }, { status: 400 });
    }
    if (!text || typeof text !== 'string') {
      return NextResponse.json({ error: 'Missing text' }, { status: 400 });
    }
    const voice = voiceName || pickVoiceFor(agentId || 'default');
    const out = await generateSpeech(text, voice, apiKey);
    return NextResponse.json(out);
  } catch (err: any) {
    console.error('[api/generate/tts] error:', err);
    return NextResponse.json(
      { error: err?.message || 'tts generation failed' },
      { status: 500 }
    );
  }
}
