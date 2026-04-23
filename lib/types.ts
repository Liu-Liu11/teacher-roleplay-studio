// 核心数据模型 —— 一切围绕 Scenario 展开

export interface Agent {
  id: string;
  name: string;                    // 角色名（例："焦虑的女儿 Sarah"）
  role: string;                    // 角色身份（例："患者家属"）
  avatar: string;                  // emoji 或 URL（生成的头像也存这里，data URL）
  persona: string;                 // 详细人设（性格、背景、说话方式）
  knowledge: string;               // 这个角色知道/不知道什么（防幻觉关键字段）
  hiddenGoals: string;             // 隐藏动机（其他 agent 看不到）
  guardrails: string[];            // 绝对不能说/做的事
  /** 如果 avatar 是 emoji/未生成，这里存生成出来的图片头像 dataURL */
  avatarImage?: string;
}

export interface RubricCriterion {
  name: string;                    // 例："沟通技巧"、"临床判断"
  description: string;
  maxScore: number;                // 通常 5 或 10
  indicators: string[];            // 观察点
}

export interface PedagogicalTrap {
  name: string;                    // 这个教学挑战点的名字
  description: string;             // 学生容易在哪里出错
  learningPoint: string;           // 触发后能学到什么
}

/**
 * 文档里的"自由章节"——让场景文档可以随对话生长，而不被固定的字段结构卡死。
 * 典型用途：多幕场景（"场景2：学生走到家属等候区"）、课前阅读、分支选项、
 * 反思环节、附加材料、老师自己想加的任何东西。
 *
 * 这些章节：
 * - 在右侧文档里可编辑（就地改标题、改正文）
 * - 会被完整嵌入到 export 的便携 scenario prompt 和 evaluation prompt 里
 * - 会被加到运行时喂给 NPC 和评估器的上下文里
 * - Pedagogy specialist 和 refine 都可以在 scenarioPatch.customSections 里增删改
 */
export interface CustomSection {
  id: string;
  title: string;
  body: string;
  /** 视觉色调，可选；默认 slate */
  tone?: 'slate' | 'blue' | 'teal' | 'amber' | 'indigo' | 'violet' | 'rose';
}

export interface Scenario {
  id: string;
  title: string;
  discipline: string;              // "nursing" | "law" | "forensic" | "social_work" | "business" | 自定义
  createdAt: number;
  updatedAt: number;
  /**
   * 结构化版本号：只有当 agents / rubric / traps / studentRole 等"会改变场景行为"的
   * 字段被改时才 +1。老的 session/library entry 会记录它生成时的 version，方便追溯。
   */
  version: number;
  /**
   * 内容修订号：每一次 updateScenario 都会 +1，不管改的是不是结构字段。
   * 用来区分"同一个结构化版本下，老师又改了标题/复习建议"这种情况——
   * 让 library / export filename 可以带 vN.rM 显示更准的 diff。
   */
  contentRevision?: number;

  // 教学法核心
  learningObjectives: string[];    // 学习目标
  targetLearners: string;          // 教学对象描述
  keyKnowledgePoints: string[];    // 关键知识点
  pedagogicalTraps: PedagogicalTrap[]; // 要设计的教学挑战点
  reviewStrategy: string;          // 复习/巩固建议

  // 场景设定
  context: string;                 // 背景设定
  studentRole: {
    name: string;
    description: string;
    startingInfo: string;          // 学生开场知道什么
  };
  openingBeat: string;             // 谁先说、说什么

  agents: Agent[];
  turnPolicy: 'director_llm' | 'round_robin' | 'student_driven';
  maxTurns: number;                // 上限
  endConditions: string[];         // 什么情况算结束

  rubric: RubricCriterion[];

  /**
   * 可自由延展的附加章节——让文档能随对话生长，承接"多幕场景 / 前置条件 / 课后反思 /
   * 老师想加的任何内容"等本身无法塞进固定字段的东西。
   */
  customSections: CustomSection[];

  /** 场景舞台背景图（Gemini 生成的 data URL，老师可以重新生成） */
  sceneImage?: string;

  /** 是否默认开启 TTS 语音播放（运行时可切） */
  ttsEnabled?: boolean;

  // 教学法专家对话历史（持续迭代）
  pedagogyChat: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
  }>;
}

export interface Message {
  id: string;
  speakerId: string;               // agent.id 或 "student" 或 "narrator"
  speakerName: string;
  content: string;
  timestamp: number;
}

export interface Session {
  id: string;
  scenarioId: string;
  scenarioVersion: number;
  runnerType: 'human_student' | 'simulated_student';
  runnerId: string;                // 真人 userId 或 模拟学生 personaId
  runnerName: string;
  transcript: Message[];
  status: 'running' | 'completed' | 'aborted';
  startedAt: number;
  endedAt?: number;
  evaluation?: Evaluation;
}

export interface SimulatedStudentPersona {
  id: string;
  name: string;
  archetype: string;               // 例："过度自信"
  avatar: string;
  persona: string;                 // 行为/语言 prompt
  skillLevel: 'novice' | 'intermediate' | 'expert';
  behaviorTraits: string[];
}

export interface HallucinationFlag {
  messageId: string;
  agentId: string;
  claim: string;                   // agent 说了什么
  issue: string;                   // 为什么是幻觉
  severity: 'low' | 'medium' | 'high';
  evidence: string;                // 对照 knowledge 字段的依据
}

export interface FidelityIssue {
  messageId: string;
  agentId: string;
  issue: string;
  severity: 'low' | 'medium' | 'high';
}

export interface Evaluation {
  sessionId: string;
  generatedAt: number;

  agentFidelity: Array<{
    agentId: string;
    agentName: string;
    score: number;                 // 0-10
    summary: string;
    issues: FidelityIssue[];
  }>;

  hallucinations: HallucinationFlag[];

  studentPerformance: {
    overallScore: number;          // 0-100
    rubricScores: Array<{
      criterionName: string;
      score: number;
      maxScore: number;
      feedback: string;
    }>;
    strengths: string[];
    weaknesses: string[];
    actionableFeedback: string;
    missedTraps: string[];         // 未触发的挑战点（可能场景太简单）
    trapsTriggered: string[];      // 触发的挑战点（是否学到）
  };

  scenarioDesignIssues: Array<{
    type: 'consistency' | 'achievability' | 'realism' | 'difficulty' | 'loop';
    description: string;
    suggestion: string;
  }>;

  overallVerdict: string;          // 一句话总结
}

// 教学法专家返回给前端的结构化响应
export interface PedagogyResponse {
  reply: string;                   // 给老师的自然语言回复
  scenarioPatch?: Partial<Scenario>; // 要对场景做的修改（结构化）
  readyToGenerate?: boolean;       // 是否可以一键生成完整场景
}

// 迭代闭环 —— 基于评估反馈建议的场景升级
export interface RefinementResponse {
  changeSummary: string;           // 一段自然语言说明这次改了什么、为什么
  bulletChanges: string[];         // 条目化变更（便于 UI 展示）
  scenarioPatch: Partial<Scenario>; // 实际的 patch
}

// Prompt 库：老师可以把导出的 prompt 存下来复用
export interface PromptLibraryEntry {
  id: string;
  scenarioId: string;              // 来源场景
  scenarioTitle: string;
  scenarioVersion: number;         // 导出那一刻的 version
  kind: 'scenario' | 'evaluation'; // 是"跑场景 prompt"还是"评估学生 prompt"
  /** 老师自己取的名字，默认 = scenarioTitle + 类型 */
  name: string;
  content: string;                 // 完整的 .txt 文本
  savedAt: number;
}
