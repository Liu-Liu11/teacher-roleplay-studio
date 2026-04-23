/**
 * Gemini 多模态 API 封装（REST 直连，不走 @ai-sdk/google，因为图像和 TTS 的
 * 响应格式需要我们手动解码 base64 inlineData）。
 *
 * 所有调用都走用户自己填的 apiKey；本地开发若设置了 HTTPS_PROXY，这里 import
 * proxy-init 保证 undici global dispatcher 已经装好。
 */
import './proxy-init';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

// Nano Banana 公开名是 "gemini-2.5-flash-image"（preview 后缀已下线）
const IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-flash-preview-tts';

interface InlineData {
  mimeType: string;
  data: string; // base64
}

interface GeminiPart {
  text?: string;
  inlineData?: InlineData;
  inline_data?: InlineData; // API 会混用 camelCase/snake_case
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: GeminiPart[] };
  }>;
  error?: { message: string };
}

async function callGemini(model: string, body: any, apiKey: string): Promise<GeminiResponse> {
  const url = `${GEMINI_BASE}/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as GeminiResponse;
  if (!res.ok) {
    throw new Error(
      `Gemini ${model} HTTP ${res.status}: ${data?.error?.message || 'unknown'}`
    );
  }
  return data;
}

function extractInlineData(resp: GeminiResponse): InlineData | null {
  const parts = resp.candidates?.[0]?.content?.parts || [];
  for (const p of parts) {
    const inline = p.inlineData || p.inline_data;
    if (inline?.data) return inline;
  }
  return null;
}

/**
 * 生成场景背景图（base64 data URL），通常 1024x768 左右。
 */
export async function generateSceneImage(
  prompt: string,
  apiKey: string
): Promise<{ dataUrl: string; mimeType: string }> {
  const fullPrompt = `Cinematic wide-shot ESTABLISHING background image for an interactive roleplay training scenario.

Scene description:
${prompt}

Compositional rules:
- Show the PHYSICAL ENVIRONMENT clearly (e.g. hospital ward, courtroom, police interview room, classroom, law office, operating theatre, street — whatever the scene calls for). The setting must be immediately recognizable.
- Wide angle, empty foreground, camera slightly elevated, so characters can be overlaid on top later
- NO humans in the frame, or at most distant out-of-focus silhouettes
- Soft realistic digital-illustration style, warm cinematic lighting
- No text, no captions, no UI, no watermarks, no logos
- Landscape 16:9 aspect`;

  const data = await callGemini(
    IMAGE_MODEL,
    {
      contents: [{ role: 'user', parts: [{ text: fullPrompt }] }],
      generationConfig: {
        responseModalities: ['IMAGE'],
      },
    },
    apiKey
  );

  const inline = extractInlineData(data);
  if (!inline) {
    throw new Error('Gemini returned no image data');
  }
  return {
    dataUrl: `data:${inline.mimeType};base64,${inline.data}`,
    mimeType: inline.mimeType,
  };
}

/**
 * 生成角色头像（正方形肖像，用于舞台卡片）。
 */
export async function generateAvatarImage(
  name: string,
  personaHint: string,
  apiKey: string
): Promise<{ dataUrl: string; mimeType: string }> {
  const prompt = `Square portrait headshot of a character for a roleplay training app. Character: ${name}. ${personaHint}
Style: soft painterly illustration, neutral warm background, shoulders up, facing camera slightly, clear expression, no text, no logos, no watermark. Single person only.`;
  const data = await callGemini(
    IMAGE_MODEL,
    {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    },
    apiKey
  );
  const inline = extractInlineData(data);
  if (!inline) throw new Error('Gemini returned no avatar image data');
  return {
    dataUrl: `data:${inline.mimeType};base64,${inline.data}`,
    mimeType: inline.mimeType,
  };
}

/**
 * 生成语音（PCM → WAV data URL）。Gemini TTS 返回的是 24kHz mono 16-bit PCM，
 * 我们需要包一层 WAV header 才能在浏览器的 <audio> 标签里播放。
 *
 * 可选 voice names 参考（官方预设）：
 *   Zephyr / Puck / Charon / Kore / Fenrir / Leda / Orus / Aoede / Callirrhoe / Autonoe ...
 */
export async function generateSpeech(
  text: string,
  voiceName: string,
  apiKey: string
): Promise<{ dataUrl: string; mimeType: string }> {
  // 截断过长的文本（TTS 免费额度很容易炸），最多 1000 字
  const clipped = text.length > 1000 ? text.slice(0, 1000) + '…' : text;
  // Gemini TTS 模型偶尔会把 prompt 当对话回复，必须显式指令 "read aloud"
  const ttsPrompt = `Read aloud, in a natural expressive speaking voice, exactly the following text (do not translate, do not add commentary, just speak it):\n\n${clipped}`;
  const data = await callGemini(
    TTS_MODEL,
    {
      contents: [{ parts: [{ text: ttsPrompt }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    },
    apiKey
  );
  const inline = extractInlineData(data);
  if (!inline) throw new Error('Gemini returned no audio data');

  // Gemini 返回的 mimeType 类似 "audio/L16;codec=pcm;rate=24000" —— 这是裸 PCM
  // 浏览器不认，我们给它加一层 WAV header
  const rate = /rate=(\d+)/.exec(inline.mimeType)?.[1];
  const sampleRate = rate ? parseInt(rate, 10) : 24000;
  const pcmBuffer = Buffer.from(inline.data, 'base64');
  const wavBuffer = pcmToWav(pcmBuffer, sampleRate);
  const wavBase64 = wavBuffer.toString('base64');
  return {
    dataUrl: `data:audio/wav;base64,${wavBase64}`,
    mimeType: 'audio/wav',
  };
}

/** 给裸 16-bit mono PCM 加 WAV 文件头 */
function pcmToWav(pcm: Buffer, sampleRate: number): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = pcm.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);           // fmt chunk size
  header.writeUInt16LE(1, 20);            // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcm]);
}

/** 根据 NPC 的一些特征，从预设 voice 池里挑一个相对匹配的 */
const VOICE_POOL = ['Zephyr', 'Puck', 'Charon', 'Kore', 'Fenrir', 'Leda', 'Orus', 'Aoede'];
export function pickVoiceFor(agentId: string): string {
  // deterministic hash
  let h = 0;
  for (let i = 0; i < agentId.length; i++) h = (h * 31 + agentId.charCodeAt(i)) >>> 0;
  return VOICE_POOL[h % VOICE_POOL.length];
}
