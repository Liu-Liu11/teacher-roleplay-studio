/**
 * 客户端友好的 TTS 音色选取 —— 不 import 任何 server-only 东西（如 proxy-init），
 * 这样 useAudioPlayer 也能直接用。
 *
 * Gemini 预设音色按公认的性别倾向分两组（混选时会从全池里挑）。如果某个音色
 * 在你的环境里听上去性别和这里标的不一致，把它移到另一组即可。
 */

import type { Agent } from './types';

// Gemini 预设音色：经过实际试听粗略分组。Gemini 全量音色更多（Enceladus / Iapetus /
// Algieba / Despina ...），但保守起见我们只用确认能用的这 8 个。
export const MALE_VOICES = ['Puck', 'Charon', 'Fenrir', 'Orus'] as const;
export const FEMALE_VOICES = ['Zephyr', 'Kore', 'Leda', 'Aoede'] as const;
export const ALL_VOICES = [...MALE_VOICES, ...FEMALE_VOICES] as const;

export type Gender = 'male' | 'female' | 'neutral';

// 中文性别标记（常见称谓 / 代词 / 亲属关系）
// 注意：每个 token 都是"足以指明性别"的标记，不会把 "他们" 之类的复数也误判
const ZH_MALE_TOKENS = [
  '男性', '男生', '男孩', '男士', '男人', '男',
  '先生', '小哥', '大哥', '哥哥', '弟弟', '大叔', '叔叔', '舅舅', '伯伯',
  '父亲', '爸爸', '爷爷', '外公', '丈夫', '老公', '儿子',
];
const ZH_FEMALE_TOKENS = [
  '女性', '女生', '女孩', '女士', '女人', '女',
  '小姐', '阿姨', '姑娘', '姐姐', '妹妹', '婶婶', '嫂子',
  '母亲', '妈妈', '奶奶', '外婆', '妻子', '老婆', '女儿',
];

// 英文性别标记（词边界）
const EN_MALE_RE = /\b(he|him|his|himself|mr\.?|mister|male|man|boy|father|dad|daddy|grandpa|grandfather|uncle|brother|husband|son|gentleman|guy)\b/i;
const EN_FEMALE_RE = /\b(she|her|hers|herself|ms\.?|mrs\.?|miss|female|woman|girl|mother|mom|mommy|grandma|grandmother|aunt|sister|wife|daughter|lady)\b/i;

/**
 * 从 agent 的 name + role + persona 文本里嗅探性别。
 * - 显式 agent.gender 优先（如果设过）
 * - 否则按 token / 正则匹配
 * - 男女信号同时出现（例如 persona 同时提到 "他" 和 "她"）→ 取首次出现的那个
 * - 都没有 → 'neutral'
 */
export function inferGender(
  agent: Pick<Agent, 'name' | 'role' | 'persona' | 'gender'>
): Gender {
  if (agent.gender === 'male' || agent.gender === 'female' || agent.gender === 'neutral') {
    return agent.gender;
  }

  const text = `${agent.name || ''} ${agent.role || ''} ${agent.persona || ''}`;

  // 找最早出现的中文性别标记
  let zhMaleIdx = Infinity;
  let zhFemaleIdx = Infinity;
  for (const t of ZH_MALE_TOKENS) {
    const i = text.indexOf(t);
    if (i !== -1 && i < zhMaleIdx) zhMaleIdx = i;
  }
  for (const t of ZH_FEMALE_TOKENS) {
    const i = text.indexOf(t);
    if (i !== -1 && i < zhFemaleIdx) zhFemaleIdx = i;
  }

  // 英文匹配（用 search 取首次匹配位置）
  const enMaleIdx = text.search(EN_MALE_RE);
  const enFemaleIdx = text.search(EN_FEMALE_RE);

  const maleIdx = Math.min(zhMaleIdx, enMaleIdx === -1 ? Infinity : enMaleIdx);
  const femaleIdx = Math.min(zhFemaleIdx, enFemaleIdx === -1 ? Infinity : enFemaleIdx);

  if (maleIdx === Infinity && femaleIdx === Infinity) return 'neutral';
  if (maleIdx < femaleIdx) return 'male';
  if (femaleIdx < maleIdx) return 'female';
  return 'neutral';
}

/**
 * 给 agent 挑一个音色名。
 * - 先按性别确定候选池（male / female / 全池）
 * - 再用 agent.id 做 hash 在池里挑一个稳定的（同一 agent 永远同一音色）
 */
export function pickVoiceForAgent(
  agent: Pick<Agent, 'id' | 'name' | 'role' | 'persona' | 'gender'> | undefined | null
): string {
  if (!agent) return ALL_VOICES[0];

  const gender = inferGender(agent);
  const pool =
    gender === 'male'
      ? MALE_VOICES
      : gender === 'female'
      ? FEMALE_VOICES
      : ALL_VOICES;

  const seed = agent.id || agent.name || '';
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return pool[h % pool.length];
}
