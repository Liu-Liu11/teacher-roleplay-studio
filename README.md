# TeacherRoleplayStudio 教师角色扮演工作台

一个让**任何学科的老师**都能创建"多智能体角色扮演教学场景"的网页平台。
老师只需要用自然语言和 **Pedagogy Specialist（教学法专家）** 聊天，它会引导你一步步把场景设计出来，一键运行，并可以用**多种性格的模拟学生**来测试场景，最后由 **评估器** 给出改进建议。

---

## 适用场景举例

- **护理（Nursing）**：急诊分诊模拟，学生扮演护士和焦虑家属、病人、主治医师沟通
- **法律（Law）**：庭审模拟辩论，学生扮演辩护律师和法官、证人、对方律师交锋
- **法证科学（Forensic Science）**：犯罪现场访谈，学生询问嫌疑人、证人、目击者
- **社工（Social Work）**：家访危机干预，学生接触受害者、加害者、儿童
- **商学（Business）**：谈判/面试模拟，学生应对刁难客户、强势老板、矛盾同事

---

## 两种使用方式

### 方式 A：直接访问在线版（推荐普通老师）

如果有人已经把这个项目部署到了 Vercel（比如一个公开链接），**你什么都不用装**：

1. 打开那个链接（例如 `https://teacher-roleplay-studio.vercel.app`）
2. 右上角点 **⚙ Settings**，填入你自己的 Gemini API key
3. 开始用

你的 API key 只存在你自己浏览器里（LocalStorage），不会被发给网站运营者，也不会被保存在服务器上——每次调用都是从你的浏览器直连 Google。

**拿 Gemini key**：
1. 打开 https://aistudio.google.com/apikey
2. 用 Google 账号登录
3. 点 **Create API Key**，复制出来（以 `AIza` 开头那一长串）
4. 粘贴到应用的设置里保存即可

Gemini 的个人免费额度足够你跑不少场景了。

---

### 方式 B：本地运行（开发者 / 想改代码）

#### 第一步：安装 Node.js
1. 去 https://nodejs.org/ 下载 **LTS 版本**
2. 双击安装，全部默认即可
3. 验证：打开 cmd，输入 `node -v`，应看到 `v20.x.x`

#### 第二步：拿 API Key（同上）

#### 第三步：配置
1. 复制 `.env.example` 为 `.env.local`
2. 填入 `GOOGLE_GENERATIVE_AI_API_KEY`
3. （**仅国内用户**）如果你本机有代理（Clash / V2Ray 等），取消 `HTTPS_PROXY` 那几行的注释

或者你可以不配环境变量——直接启动、在 UI 里填自己的 key 也行。

#### 第四步：启动
```bash
npm install
npm run dev
```
看到 `Local: http://localhost:3000` 就成功。

---

## 部署到 Vercel（让全世界的老师都能用）

这个项目完全兼容 Vercel 零配置部署。

1. **把项目推到 GitHub**（自己的账号任选 public / private 都行）
   ```bash
   cd TeacherRoleplayStudio
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/你的用户名/你的仓库名.git
   git push -u origin main
   ```

2. **到 Vercel 导入项目**
   - 打开 https://vercel.com/new 用 GitHub 登录
   - 选刚才推的仓库 → **Import**
   - Framework Preset 会自动识别为 Next.js，不用改任何东西
   - 可选：Environment Variables 里**不用填任何东西**——因为每个用户在 UI 里填自己的 key
     （如果你想给自己或少数熟人免配 key，可以在这里填 `GOOGLE_GENERATIVE_AI_API_KEY` 作为 fallback）
   - 点 **Deploy**，等 1–2 分钟

3. **拿到公开 URL**
   - Deploy 成功后会拿到类似 `https://xxxx.vercel.app` 的链接
   - 发给任何人，他们打开就能用（对方填自己的 Gemini key）

> ⚠️ **重要**：部署到 Vercel **不要**设 `HTTPS_PROXY/HTTP_PROXY` 环境变量——那是只有国内本地开发才需要的。Vercel 服务器在海外能直连 Google。

---

---

## 怎么用（流程图）

```
┌────────────────────────────────────────────────────────────┐
│ 1. 首页：看到你创建过的所有场景，点"新建场景"              │
└────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────┐
│ 2. 设计页：左边是 Pedagogy Specialist 在和你对话          │
│    它会问：                                                │
│    - 你要教什么课？学生是谁？                              │
│    - 你希望学生学到什么知识点？                            │
│    - 你想在场景里设计哪些"坑"让学生踩？                    │
│    - 学生扮演什么角色？和谁对话？                          │
│    - 什么算成功？怎么评估？                                │
│    右边是 场景草稿 实时更新                                │
│    → 聊到差不多，专家说"准备好了" → 点【一键生成】         │
└────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────┐
│ 3. 运行页：你可以                                          │
│    (a) 自己扮演学生试跑 → 感受场景                         │
│    (b) 选一个或多个"模拟学生人格"自动跑 → 批量测试         │
│        · 过度自信型  · 害羞被动型  · 敌对对抗型            │
│        · 知识空白型  · 伦理擦边型  · ...                   │
│    跑完自动出【评估报告】：                                │
│        · 每个 AI 角色有没有崩人设                          │
│        · 有没有幻觉（说了不该知道的事）                    │
│        · 学生表现打分 + 反馈                               │
│        · 场景本身的设计问题                                │
└────────────────────────────────────────────────────────────┘
                             │
                             ▼
┌────────────────────────────────────────────────────────────┐
│ 4. 不满意？回到设计页，告诉 Pedagogy Specialist：          │
│    "刚才那个律师角色太配合了，我想让他更强势"              │
│    → 它自动修改场景 → 再测 → 再改，直到满意                │
└────────────────────────────────────────────────────────────┘
```

---

## 常见问题

**Q: 数据存在哪里？**
A: 当前所有场景存在你浏览器的本地存储里（LocalStorage）。换浏览器 / 清缓存会丢失。下一版会加云端存储。

**Q: 中文 / English 怎么切？**
A: 页面右上角有个小按钮「中文 / EN」，点一下 UI 文字和所有 AI（教学法专家、NPC、模拟学生、评估器）的回复都会跟着切换。切换后已有的对话记录不会翻译，但此后新的回复会用新语言。

**Q: Gemini 和 Claude 怎么选？**
A: 免费、快、上手低门槛选 **Gemini 2.5 Flash**（默认）。想要更稳更细腻的长对话扮演选 **Claude Sonnet 4.6**。一个 project 里两个都配好也行，改 `LLM_PROVIDER` 即可切。

**Q: 模拟学生会不会太假？**
A: 每个模拟学生用了不同人格 prompt，故意制造各种"真实学生行为"——包括错别字、敷衍、挑战权威。跑几次你就能感受到差别。

**Q: 怎么让互动更"真人"——有画面、有声音？**
A: 在运行页的舞台上方有三个按钮：
- **🎨 生成场景图** — 用 Gemini Nano Banana 画一张背景图，让整个舞台有电影感
- **🎭 生成角色头像** — 给每个 NPC 画一张肖像，替代 emoji
- **🔊 语音：开** — 开启后，NPC 每句话自动用 Gemini TTS 朗读（每条消息也有 ▶ 手动播放按钮，支持 8 种声线）
这些都用你自己的 Gemini key 调用，存在场景对象里；免费额度够普通老师用几十次。

**Q: 我能分享场景给其他老师吗？**
A: 暂时用"导出 JSON → 发给对方 → 对方导入"。这个功能已内置。

**Q: API key 填在哪？安全吗？**
A: 页面右上角有个 **⚙ Settings** 按钮，点开就能填。Key 只存在你自己浏览器的 LocalStorage 里，每次调用从你的浏览器**直连 Google/Anthropic**——不会被发到本项目的服务器、也不会被网站部署者看到。清浏览器数据就会丢。

---

## 项目结构（给懂技术的朋友看的）

```
TeacherRoleplayStudio/
├── app/
│   ├── page.tsx                # 场景列表主页
│   ├── design/[id]/page.tsx    # 对话式设计页（pedagogy specialist）
│   ├── run/[id]/page.tsx       # 运行 + 测试 + 评估（Stage 舞台式 UI）
│   └── api/
│       ├── pedagogy/route.ts   # 教学法专家聊天 + 场景生成/改写
│       ├── run/route.ts        # 场景运行（单轮多 agent 响应）
│       ├── simulate/route.ts   # 完整模拟学生自动跑
│       ├── evaluate/route.ts   # 评估 transcript
│       └── generate/
│           ├── image/route.ts  # Gemini 场景图 + 头像生成
│           └── tts/route.ts    # Gemini 语音合成（24kHz WAV）
├── lib/
│   ├── types.ts                # Scenario / Agent / Session / Evaluation（含 sceneImage, avatarImage）
│   ├── store.ts                # Zustand 本地存储（含 UI locale + userApiKey + v1→v2 迁移）
│   ├── llm.ts                  # Claude / Gemini 文本调用封装（支持 per-request apiKey）
│   ├── gemini-media.ts         # Gemini 图像 + TTS 封装（REST，PCM→WAV 转码）
│   ├── useAudioPlayer.ts       # TTS 播放 hook（同时只放一条、缓存 dataURL）
│   ├── i18n.ts                 # 中英双语字典 + useT() 钩子
│   ├── prompts.ts              # 所有 prompt 模板（按 locale 注入语言指令）
│   └── simulated-students.ts   # 10 个模拟学生人格 × 中英两套
└── components/
    ├── Button.tsx
    ├── LanguageSwitcher.tsx    # 右上角「中文 / EN」切换器
    ├── ApiKeySettings.tsx      # ⚙ Settings 按钮 + 填 key 弹窗 + 缺 key 横幅
    └── stage/
        ├── Avatar.tsx          # 头像 · 说话时放大 + 脉冲光环 + 9 条波形
        ├── SpeechBubble.tsx    # 冒泡 · 弹簧入场动画 + ▶ 语音播放按钮
        ├── Stage.tsx           # 舞台容器 · 背景图 + NPC 排布 + 自动滚动
        └── StageMediaControls.tsx  # 生成场景图 / 头像 / 切 TTS 开关
```

---

## 许可证
MIT（你可以随意修改、商用、分发）
