// 极简 i18n：一个 zh/en 字典 + t() + languageLabel()
// 纯模块：不依赖 React，不依赖 store，server-side API routes 也能安全 import。
// React 钩子 useT() 请从 './useT' 导入（那边是 'use client'）。

export type Locale = 'zh' | 'en';

const dict = {
  zh: {
    // ─── 通用 ───
    loading: '加载中…',
    confirm_delete: '确定删除 "{name}" ？',
    delete: '删除',
    remove: '删除',
    back: '← 返回',
    send: '发送',
    thinking: '正在思考…',
    unnamed: '未命名场景',
    uncategorized: '未分类',
    updated_at: '更新于 {time}',
    ok: '好的',
    cancel: '取消',

    // ─── 首页 ───
    home_title: '🎭 TeacherRoleplayStudio',
    home_subtitle: '教师角色扮演工作台 · 对话式创建多智能体教学场景',
    import_scenario: '导入场景',
    new_scenario: '+ 新建场景',
    empty_title: '还没有场景，从创建第一个开始',
    empty_subtitle: '点击"新建场景"，教学法专家会和你对话，一步步把场景设计出来',
    create_first: '+ 新建我的第一个场景',
    use_cases_title: '适用场景举例',
    uc_nursing: '护理',
    uc_nursing_sub: '急诊分诊 / 家属沟通',
    uc_law: '法律',
    uc_law_sub: '模拟庭审 / 调解谈判',
    uc_forensic: '法证',
    uc_forensic_sub: '嫌疑人询问 / 证人访谈',
    uc_social: '社工',
    uc_social_sub: '家访干预 / 危机处理',
    uc_business: '商学',
    uc_business_sub: '谈判 / 面试 / 冲突调解',
    uc_any: '任何学科',
    uc_any_sub: '只要需要"角色对话"',
    stat_agents: '👥 {n} agents',
    stat_goals: '🎯 {n} 目标',
    stat_traps: '⚠️ {n} 挑战点',
    footer_note: '数据存于浏览器本地（LocalStorage） · 清理缓存会丢失 · 记得定期"导出"备份',
    import_failed: '导入失败：不是有效的场景文件',
    no_scenarios: '还没有场景',

    // ─── Landing（首次访问的引导页） ───
    landing_hero_tagline: '用对话，搭建属于你的多角色教学场景',
    landing_hero_body:
      '告诉教学法专家你要教什么、学生容易在哪里卡住，几分钟内就能得到一个可直接上课用的多 NPC 角色扮演场景——还配上 AI 生成的情境图与模拟学生测试。',
    landing_primary_cta: '🚀 开始创建我的第一个场景',
    landing_secondary_cta: '已有文件？导入场景',
    landing_how_title: '三步从想法到可上课的场景',
    landing_how_step1_title: '1. 说说你想教什么',
    landing_how_step1_body:
      '对教学法专家用大白话描述：学科、学生背景、希望他们学会什么。不需要写prompt。',
    landing_how_step2_title: '2. 专家帮你设计',
    landing_how_step2_body:
      '自动生成 NPC 角色、隐藏动机、教学挑战点（trap），并用 Gemini 生成一张情境图。',
    landing_how_step3_title: '3. 运行 / 测试 / 导出',
    landing_how_step3_body:
      '用模拟学生批量跑场景、看评估报告，满意后导出给课堂或 LMS 使用。',
    landing_features_title: '平台能为你做什么',
    landing_feat_npc_title: '🎭 多角色 NPC',
    landing_feat_npc_body:
      '一个场景里可以同时有多个 AI 角色，各有自己的人设、知识边界、隐藏动机与护栏。',
    landing_feat_image_title: '🖼️ AI 生成情境图',
    landing_feat_image_body:
      '自动用 Gemini 生成符合场景氛围的图像与 NPC 头像，学生一眼进入情境。',
    landing_feat_students_title: '🤖 模拟学生测试',
    landing_feat_students_body:
      '用不同类型的模拟学生（菜鸟 / 高手 / 乱跑型）批量跑你的场景，提前发现 bug。',
    landing_feat_eval_title: '📊 教学评估报告',
    landing_feat_eval_body:
      '每次跑完自动给出评估：学生是否命中目标、是否踩到挑战点、哪里需要改进。',
    landing_feat_export_title: '📥 一键导出',
    landing_feat_export_body:
      '导出完整 prompt 或 JSON 场景包，带到 GPT / Claude / 任何平台都能继续用。',
    landing_feat_bilingual_title: '🌐 中英双语',
    landing_feat_bilingual_body:
      '界面、提示词、生成内容都支持中英切换，团队里中英混合也没问题。',
    landing_cta_title: '准备好了吗？',
    landing_cta_body: '点下面的按钮，教学法专家会马上和你对话。',
    landing_privacy_note:
      '所有数据保存在你自己浏览器的 LocalStorage 里，不会上传到服务器，也看不到其他老师的场景。',
    landing_screenshots_title: '长这样',
    landing_screenshot_design_caption: '设计场景：与教学法专家对话式完善草稿',
    landing_screenshot_run_caption: '运行场景：和多个 AI 角色对话，带情境图与语音',

    // ─── 设计页 ───
    export: '📥 导出',
    run_test: '▶️ 运行 / 测试',
    run_test_disabled: '还需要至少有 agent、学生角色、学习目标才能运行',
    run_test_disabled_with_fields: '还缺：{list}',
    missing_field_agents: '至少 1 个 NPC',
    missing_field_student_role: '学生角色名称',
    missing_field_objectives: '至少 1 条学习目标',
    title_placeholder: '给场景起个名字…',
    specialist_title: '💡 Pedagogy Specialist',
    specialist_subtitle: '和我对话，我会一步步帮你把教学场景设计好',
    specialist_role_label: '🎓 教学法专家',
    input_placeholder: '回复专家的问题，或告诉我你想改什么…（Enter 发送，Shift+Enter 换行）',
    ready_to_run_banner:
      '✅ 场景基本就绪！点右上角【运行/测试】去跑一下，跑完不满意再回来告诉我改哪里。',
    specialist_error: '教学法专家调用失败：{msg}',

    // 草稿区
    section_overview: '📌 场景概要',
    field_discipline: '学科',
    field_discipline_ph: '如：nursing / law / business…',
    field_learners: '教学对象',
    field_learners_ph: '例：大三护理本科生，修过急诊护理课程…',
    field_context: '场景背景',
    field_context_ph: '时间、地点、起因…',
    section_objectives: '🎯 教学目标',
    objectives_ph: '例：能识别早期脓毒症表现…',
    section_knowledge: '📚 关键知识点',
    knowledge_ph: '例：qSOFA 评分 / MEWS…',
    section_traps: '⚠️ 教学挑战点（Pedagogical Traps）',
    traps_hint: '让教学法专家帮你设计"教学挑战点"——学生在这些地方容易出错，真正的学习就在这里发生',
    trap_name_ph: '挑战点名称',
    trap_desc_ph: '学生容易怎么犯错',
    trap_learning_ph: '经历后能学到什么',
    section_student_role: '👤 学生角色',
    sr_name: '身份',
    sr_name_ph: '例：见习律师 / 分诊护士 / 实习社工…',
    sr_desc: '描述',
    sr_starting: '开场已知信息',
    sr_starting_ph: '学生开场知道的信息，决定了难度和公平性',
    section_agents: '👥 AI 角色（NPC）',
    agent_unnamed: '未命名角色',
    agent_name: '姓名',
    agent_role: '身份/角色',
    agent_avatar: '头像 emoji',
    agent_persona: '人设 Persona',
    agent_knowledge: '🎯 知识边界（只能知道这些）',
    agent_knowledge_ph: '这个角色知道哪些事。评估器会用这个来检测幻觉。',
    agent_hidden: '🤫 隐藏动机（其他人不知道）',
    agent_guardrails: '🚧 护栏（绝不能做的事）',
    agent_guardrail_ph: '如：不能主动说出疾病名称…',
    agent_delete: '删除此角色',
    add_agent: '+ 添加角色',
    section_rubric: '📋 评分量表（Rubric）',
    rubric_name_ph: '维度名，如：沟通技巧',
    rubric_desc_ph: '这个维度描述',
    rubric_indicators_ph: '观察点',
    add_rubric: '+ 添加评分维度',
    section_opening_end: '🏁 开场 & 结束条件',
    opening_label: '开场白（旁白或第一个说话的角色说什么）',
    max_turns_label: '最大回合数',
    end_conditions_label: '结束条件',
    end_conditions_ph: '例：学生做出诊断判断',
    section_review: '🔁 复习策略',
    review_ph: '跑完场景后，学生怎么巩固？例：写一段 SBAR 交班 / 回答 3 个反思问题…',
    list_add_hint: '输入后按 Enter 添加',
    list_add_default: '新增一条',
    scenario_not_found: '场景不存在',
    back_home: '返回首页',
    first_visit_trigger:
      '（老师刚打开工作台，还没开始说话。请你用开场白介绍自己，并问第一个破冰问题。）',

    // ─── 运行页 ───
    back_to_design: '← 返回设计',
    tab_live: '👤 自己试跑',
    tab_simulate: '🤖 模拟学生测试',
    tab_history: '📜 历史记录 ({n})',

    live_title: '自己当学生，实际跑一次场景',
    live_subtitle: '你会扮演 {role}，和 {n} 个 AI 角色对话',
    role_student: '学生',
    start: '▶️ 开始',
    end_manual: '⏹ 手动结束',
    restart: '🔄 重新开始',
    empty_live: '点【开始】来跑一次场景。\n你会看到 AI 角色和你交互。',
    ai_thinking: 'AI 角色正在思考…',
    scenario_ended: '场景已结束',
    student_input_ph: '以 {role} 的身份回复…',
    generate_eval: '📊 生成评估报告',
    generating_eval: '生成评估中…',
    eval_failed: '评估失败：{msg}',
    run_failed: '运行失败：{msg}',
    teacher_self: '教师本人',
    end_by_teacher: '教师手动结束',

    sim_title: '选择模拟学生人格，让它们自动跑场景',
    sim_subtitle:
      '可以多选。每个选中的人格会独立跑完一次场景并生成评估。测试目的：看场景在各种类型学生面前是否依然可靠。',
    run_selected: '▶️ 让选中的 {n} 个学生测试',
    sim_running: '运行中… ({name})',
    sim_time_hint: '每个学生约需 30-90 秒',
    sim_failed: '{name} 失败：{msg}',

    end_reason_normal: '正常结束',

    matrix_title: '📊 测试矩阵',
    col_student: '学生',
    col_performance: '学生表现',
    col_fidelity: 'Agent 保真',
    col_hallu: '幻觉数',
    col_issues: '场景问题',
    col_end_reason: '结束原因',
    eval_fail_row: '评估失败',
    result_title: '{avatar} {name} 的运行结果',
    view_full_convo: '📝 查看完整对话（{n} 条）',
    eval_gen_failed: '评估生成失败',

    empty_history: '还没有运行过。去【自己试跑】或【模拟学生测试】来跑一次吧。',
    conversation_log: '对话记录（{n} 条）',
    history_scenario_version: '场景 v{v} · {time}',
    history_score: '得分: {s}/100',
    history_select_hint: '选择左边一次会话来查看详情',

    eval_overall_score: '综合得分',
    eval_verdict_title: '总评',
    eval_student_perf: '👤 学生表现',
    eval_strengths: '✅ 强项',
    eval_weaknesses: '⚠️ 需改进',
    eval_feedback: '💬 反馈',
    eval_traps_triggered: '⚠️ 触发的挑战点（可能学到了）',
    eval_traps_missed: '未触发的挑战点',
    eval_fidelity: '🎭 Agent 角色保真度',
    eval_hallucinations: '🧠 幻觉/越界',
    no_hallucinations: '未检测到幻觉 ✨',
    hallu_said: '说了：「{claim}」',
    hallu_evidence: '依据: {ev}',
    eval_design_issues: '🔧 场景设计问题',
    no_design_issues: '场景设计看起来没大问题',
    design_suggestion: '💡 建议: {s}',
    narrator: '旁白',
    you_as: '你（{role}）',
    simulated_as: '{name}（扮演{role}）',
    end_reason_director: 'director 判定结束',
    end_reason_student: '学生主动结束',
    end_reason_max_turns: '达到最大回合数',
    end_reason_no_agent: 'agent 不存在',

    // ─── API Key 设置 ───
    settings: '⚙ 设置',
    apikey_title: '🔑 Gemini API Key',
    apikey_desc:
      '本工具使用 Google Gemini 模型。你需要一个免费的 API key 才能运行。',
    apikey_get_hint: '还没有？去',
    apikey_get_link: 'Google AI Studio',
    apikey_get_suffix: '免费申请一个（1 分钟）',
    apikey_input_ph: '粘贴你的 Gemini API key（以 AIza 开头）',
    apikey_privacy:
      '🔒 你的 key 只会存在你自己的浏览器里（LocalStorage），不会被发送到任何第三方服务器。每次调用会直接从你的浏览器发到 Google。',
    apikey_save: '保存',
    apikey_clear: '清除 key',
    apikey_saved: '✅ 已保存',
    apikey_status_set: '已设置（以 {prefix} 开头）',
    apikey_status_unset: '❗ 未设置',
    apikey_banner_missing:
      '👋 开始之前，先设置你的 Gemini API key — ',
    apikey_banner_cta: '点这里设置',
    apikey_missing_error:
      '请先在右上角【设置 ⚙】里填入你的 Gemini API key',

    // ─── 舞台 / 多模态 ───
    stage_scene_label: '场景',
    stage_scene_image_label: '场景图',
    stage_scene_ready: '场景舞台 · 点击「开始」进入',
    stage_generate_scene: '🎨 生成场景图',
    stage_regenerate_scene: '🔄 重新生成场景图',
    stage_generate_avatars: '🎭 生成角色头像',
    stage_tts_on: '🔊 语音：开',
    stage_tts_off: '🔇 语音：关',
    stage_generating_scene: '正在画场景…',
    stage_generating_avatars: '正在画头像…',
    stage_media_failed: '媒体生成失败：{msg}',
    stage_retry: '↻ 重试',
    stage_scene_hint: '可选：为这个场景生成一张背景图，让互动更有画面感',
    stage_avatars_hint: '可选：为 NPC 生成真实感的头像（替代 emoji）',
    stage_tts_hint: '点消息旁的 ▶ 听 AI 用不同声线朗读',

    // ─── 迭代闭环（Refine） ───
    refine_cta: '🔁 基于本次评估优化场景',
    refine_cta_multi: '🔁 基于以上 {n} 次评估统一优化场景',
    refine_running: '教学法专家正在分析评估证据…',
    refine_failed: '场景优化失败：{msg}',
    refine_modal_title: '场景升级建议',
    refine_summary_label: '升级说明',
    refine_changes_label: '具体变动',
    refine_apply: '✅ 应用到场景（版本 +1）',
    refine_apply_and_run: '✅ 应用并立刻重跑',
    refine_dismiss: '先不改',
    refine_applied_toast: '已升级到 v{v}。下次跑就是新版本。',
    refine_elapsed: '已耗时 {s} 秒…',
    refine_timeout:
      '请求超过 90 秒未响应。Gemini 可能比较慢或网络不稳——请再试一次。',
    refine_no_changes_title: '本次评估没有触发具体改动',
    refine_no_changes_body:
      '教学法专家看过了这次评估证据，但**没有提出**可落地的场景修改。可能是本次表现已经覆盖了关键挑战点，或者证据还不够支持改动。建议再跑几次模拟学生、积累更多证据后再来。',
    refine_no_changes_ok: '知道了',
    refine_diff_heading: '即将改动的字段',
    refine_diff_none: '（没有字段级改动，仅版本号 +1）',
    refine_diff_field: '{name}',
    refine_applied_banner_title: '✅ 场景已升级到 v{v}',
    refine_applied_banner_fields: '实际改动的字段：{list}',
    refine_applied_banner_nofields:
      '教学法专家建议了自然语言变更，但没有 structural 字段被改动——版本仍为 v{v}。',
    refine_applied_banner_close: '收起',

    // ─── 导出 / Prompt 库 ───
    export_modal_title: '导出场景 Prompt',
    export_modal_sub:
      '这两份 prompt 可以贴到任何大模型（ChatGPT / Claude / Gemini）直接用，是你的教学资产。',
    export_kind_scenario: '🎭 场景 Prompt（让 LLM 跑这个场景）',
    export_kind_evaluation: '📊 评估 Prompt（让 LLM 评学生）',
    export_download_txt: '⬇ 下载 .txt',
    export_copy: '📋 复制',
    export_copied: '已复制',
    export_save_library: '💾 存到 Prompt 库',
    export_saved_library: '已保存 ✓',
    export_preview: '预览',
    export_close: '关闭',

    library_button: '📚 Prompt 库',
    library_title: '📚 我的 Prompt 库',
    library_subtitle: '所有导出过的场景 / 评估 prompt 都在这里，可以随时复制、下载、改名。',
    library_empty:
      '还没存过 prompt。到场景设计页 → 【📥 导出】→ 【💾 存到 Prompt 库】',
    library_filter_all: '全部',
    library_filter_scenario: '场景 Prompt',
    library_filter_evaluation: '评估 Prompt',
    library_rename_ph: '给它起个名字',
    library_from_scenario: '来自场景「{title}」v{v}',
    library_saved_at: '存于 {time}',
    library_confirm_delete: '确定删除「{name}」？',
    library_type_scenario: '🎭 场景',
    library_type_evaluation: '📊 评估',

    // ─── 历史 & 版本标注 ───
    history_ran_on_version: '跑的是 v{v}',
    history_current_version: '当前场景已是 v{v}',
    history_version_mismatch:
      '⚠️ 这次测试跑的是 v{sv}，你已经把场景升级到了 v{cv}。下面的"基于此评估优化场景"会基于 v{cv} 再改一版。',
    history_refine_title: '基于这次测试的评估再优化场景',
    history_refine_sub: '把这次会话的证据喂给教学法专家，产出一个新的 scenarioPatch。',
    history_rerun_current: '▶ 用当前 v{v} 去 Live 重跑',
    history_rerun_sim: '▶ 用当前 v{v} 跑模拟学生',
    running_on_version: '运行版本：v{v}',
    sim_result_version: '{name} · 用 v{v} 跑的',

    // ─── 文档视图（右侧 Word 文档样式编辑器） ───
    doc_title_ph: '场景标题…',
    doc_discipline_ph: '学科',
    doc_learners_ph: '教学对象（如：大三护理本科生，修过急诊护理课）',
    doc_section_context: '场景背景',
    doc_context_ph: '时间、地点、起因——用自然的叙述把场景画面感写出来。例：周五下午 16:20，急诊分诊台，一位神情焦虑的女士推着轮椅进来……',
    doc_section_objectives: '学习目标',
    doc_objective_ph: '例：能识别早期脓毒症表现',
    doc_add_objective: '添加学习目标',
    doc_section_knowledge: '关键知识点',
    doc_knowledge_ph: '例：qSOFA 评分三要素',
    doc_add_knowledge: '添加知识点',
    doc_section_traps: '教学挑战点（Pedagogical Traps）',
    doc_traps_hint:
      '学生要在这些地方犯一次错，真正的学习才会发生。让教学法专家帮你设计——不要手软。',
    doc_trap_label: '挑战点 {i}',
    doc_trap_name_ph: '挑战点的简短名字，如"被家属情绪带偏"',
    doc_trap_desc_ph: '学生容易在这里怎么错？场景里用什么线索引他进去？',
    doc_trap_learning_label: '→ 经历后能学到',
    doc_trap_learning_ph: '例：在高情绪场合保持临床优先级',
    doc_add_trap: '添加一个教学挑战点',
    doc_section_student: '学生角色',
    doc_student_role_prefix: '身份：',
    doc_student_name_ph: '例：分诊护士',
    doc_student_desc_ph: '学生这轮扮演谁，背景是什么？',
    doc_student_starting_label: '开场学生掌握的信息',
    doc_student_starting_ph:
      '学生开场那一刻看到/听到/手上有什么——这决定了难度和公平性',
    doc_section_agents: 'AI 角色（NPC）',
    doc_agent_name_ph: '角色姓名',
    doc_agent_role_ph: '身份，如"焦虑的女儿"',
    doc_agent_persona_label: '人设',
    doc_agent_persona_ph: '性格、背景、说话方式、情绪底色',
    doc_agent_knowledge_label: '知识边界',
    doc_agent_knowledge_hint: '这个角色只知道以下这些事——超出即判为幻觉',
    doc_agent_knowledge_ph: '写清楚这个 NPC 应该知道什么、不知道什么',
    doc_agent_hidden_label: '隐藏动机',
    doc_agent_hidden_hint: '其他角色和学生都看不到，但会影响他的选择',
    doc_agent_hidden_ph: '例：怕被追责，所以会下意识回避某些问题',
    doc_agent_guardrails_label: '护栏',
    doc_agent_guardrails_hint: '绝对不能做/说的事',
    doc_agent_guardrail_ph: '例：不能主动说出诊断结论',
    doc_add_guardrail: '添加一条护栏',
    doc_add_agent: '添加一个 NPC 角色',
    doc_section_opening: '开场',
    doc_opening_ph:
      '场景怎么打开——旁白一句，或者某个 NPC 直接开口说的话',
    doc_section_flow: '发言流程与结束条件',
    doc_max_turns_label: '最大回合数：',
    doc_max_turns_hint: '超过这个数场景自动收束',
    doc_end_conditions_label: '满足以下任意一条即结束',
    doc_end_condition_ph: '例：学生做出诊断判断',
    doc_add_end_condition: '添加结束条件',
    doc_section_rubric: '评分量表 Rubric',
    doc_rubric_name_ph: '维度名，如"临床判断"',
    doc_rubric_desc_ph: '这个维度在评估什么？',
    doc_rubric_indicators_label: '观察点（在对话中能直接看到的行为）',
    doc_rubric_indicator_ph: '例：主动询问既往史',
    doc_add_indicator: '添加观察点',
    doc_add_rubric: '添加评分维度',
    doc_section_review: '复习策略',
    doc_review_ph:
      '场景跑完后，学生怎么巩固？例：写一段 SBAR 交班 / 回答 3 个反思问题',
    doc_footer_hint:
      '这份文档就是整个教学场景的唯一版本——所有的试跑、模拟学生、评估、导出都基于它。左边跟教学法专家聊天会自动改它；也可以直接在这里编辑。',

    // 可延展的自定义章节
    doc_add_custom_heading: '继续展开这份教案',
    doc_add_custom_hint:
      '如果上面的固定结构装不下——比如要加"场景 2"、"课前阅读"、"分支岔路"、"反思环节"——在这里加一个新章节。老师和教学法专家对话的过程中也会往这里追加。',
    doc_add_custom_slate: '普通章节',
    doc_add_custom_blue: '目标类',
    doc_add_custom_teal: '知识/材料',
    doc_add_custom_amber: '挑战/风险',
    doc_add_custom_indigo: '学生相关',
    doc_add_custom_violet: 'NPC / 场景',
    doc_add_custom_rose: '反思 / 风险提示',
    doc_custom_title_ph: '章节标题，例：场景 2 · 家属等候区',
    doc_custom_body_ph:
      '在这里写正文——描述这一段发生什么、老师想让学生经历什么、任何额外规则……',
    doc_custom_move_up: '上移',
    doc_custom_move_down: '下移',
    doc_custom_remove: '删除这一章节',
  },
  en: {
    // ─── Common ───
    loading: 'Loading…',
    confirm_delete: 'Delete "{name}"?',
    delete: 'Delete',
    remove: 'Remove',
    back: '← Back',
    send: 'Send',
    thinking: 'Thinking…',
    unnamed: 'Untitled Scenario',
    uncategorized: 'Uncategorized',
    updated_at: 'Updated {time}',
    ok: 'OK',
    cancel: 'Cancel',

    // ─── Home ───
    home_title: '🎭 TeacherRoleplayStudio',
    home_subtitle:
      "Teacher's Roleplay Studio · Conversational multi-agent scenario builder",
    import_scenario: 'Import Scenario',
    new_scenario: '+ New Scenario',
    empty_title: 'No scenarios yet — create your first one',
    empty_subtitle:
      'Click "New Scenario" and the Pedagogy Specialist will walk you through the design step by step.',
    create_first: '+ Create My First Scenario',
    use_cases_title: 'Example Use Cases',
    uc_nursing: 'Nursing',
    uc_nursing_sub: 'Triage / Family communication',
    uc_law: 'Law',
    uc_law_sub: 'Mock trial / Mediation',
    uc_forensic: 'Forensics',
    uc_forensic_sub: 'Suspect interview / Witness',
    uc_social: 'Social Work',
    uc_social_sub: 'Home visit / Crisis response',
    uc_business: 'Business',
    uc_business_sub: 'Negotiation / Interview',
    uc_any: 'Any Discipline',
    uc_any_sub: 'Anywhere role conversation is needed',
    stat_agents: '👥 {n} agents',
    stat_goals: '🎯 {n} goals',
    stat_traps: '⚠️ {n} traps',
    footer_note:
      'Data lives in your browser (LocalStorage) · clearing cache will lose it · remember to Export backups',
    import_failed: 'Import failed: not a valid scenario file',
    no_scenarios: 'No scenarios',

    // ─── Landing (first-visit onboarding) ───
    landing_hero_tagline: 'Design multi-character teaching scenarios — just by chatting',
    landing_hero_body:
      'Tell the Pedagogy Specialist what you want to teach and where students usually get stuck. In a few minutes you get a ready-to-use multi-NPC role-play scenario, with an AI-generated scene image and simulated students for testing.',
    landing_primary_cta: '🚀 Create my first scenario',
    landing_secondary_cta: 'Already have a file? Import scenario',
    landing_how_title: 'Three steps from idea to classroom-ready scenario',
    landing_how_step1_title: '1. Tell it what you teach',
    landing_how_step1_body:
      'Describe in plain language: discipline, student background, what you want them to learn. No prompt engineering required.',
    landing_how_step2_title: '2. The specialist designs with you',
    landing_how_step2_body:
      'It generates NPCs, hidden motivations and pedagogical traps, and uses Gemini to paint a scene image.',
    landing_how_step3_title: '3. Run, test, export',
    landing_how_step3_body:
      'Batch-run the scenario with simulated students, review the evaluation report, and export when you are happy.',
    landing_features_title: 'What this platform does for you',
    landing_feat_npc_title: '🎭 Multi-character NPCs',
    landing_feat_npc_body:
      'Multiple AI characters per scenario — each with its own persona, knowledge boundary, hidden motives and guardrails.',
    landing_feat_image_title: '🖼️ AI scene images',
    landing_feat_image_body:
      'Gemini paints scene and avatar images that match the situation, so students feel the context immediately.',
    landing_feat_students_title: '🤖 Simulated students',
    landing_feat_students_body:
      'Batch-test your scenario with different student archetypes (novice / expert / distracted) and find issues before class.',
    landing_feat_eval_title: '📊 Evaluation reports',
    landing_feat_eval_body:
      'After every run you get an automatic report: hit objectives, triggered traps, and suggested fixes.',
    landing_feat_export_title: '📥 One-click export',
    landing_feat_export_body:
      'Export the full prompt or a JSON bundle — bring it to GPT, Claude or any other platform.',
    landing_feat_bilingual_title: '🌐 Bilingual ZH / EN',
    landing_feat_bilingual_body:
      'UI, prompts and generated content all switch between Chinese and English.',
    landing_cta_title: 'Ready to start?',
    landing_cta_body: 'Click below and the Pedagogy Specialist will start chatting with you.',
    landing_privacy_note:
      'All data stays in your own browser LocalStorage — never uploaded, never visible to other teachers.',
    landing_screenshots_title: 'Here is what it looks like',
    landing_screenshot_design_caption:
      'Design: shape the draft by chatting with the Pedagogy Specialist',
    landing_screenshot_run_caption:
      'Run: converse with multiple AI characters, with scene image and voice',

    // ─── Design page ───
    export: '📥 Export',
    run_test: '▶️ Run / Test',
    run_test_disabled:
      'Needs at least one agent, a student role, and learning objectives before running',
    run_test_disabled_with_fields: 'Missing: {list}',
    missing_field_agents: 'at least 1 NPC',
    missing_field_student_role: 'student role name',
    missing_field_objectives: 'at least 1 learning objective',
    title_placeholder: 'Give your scenario a name…',
    specialist_title: '💡 Pedagogy Specialist',
    specialist_subtitle:
      "Chat with me and I'll guide you through designing the scenario step by step.",
    specialist_role_label: '🎓 Pedagogy Specialist',
    input_placeholder:
      "Reply to the specialist or tell me what to change… (Enter to send, Shift+Enter newline)",
    ready_to_run_banner:
      '✅ Scenario is ready! Click Run/Test on the top right. Come back and tell me what to change after you try it.',
    specialist_error: 'Pedagogy Specialist failed: {msg}',

    section_overview: '📌 Overview',
    field_discipline: 'Discipline',
    field_discipline_ph: 'e.g., nursing / law / business…',
    field_learners: 'Target Learners',
    field_learners_ph:
      'e.g., Third-year nursing undergraduates, completed emergency-care course…',
    field_context: 'Scenario Context',
    field_context_ph: 'Time, place, trigger…',
    section_objectives: '🎯 Learning Objectives',
    objectives_ph: 'e.g., Identify early signs of sepsis…',
    section_knowledge: '📚 Key Knowledge Points',
    knowledge_ph: 'e.g., qSOFA score / MEWS…',
    section_traps: '⚠️ Pedagogical Traps',
    traps_hint:
      'Ask the Pedagogy Specialist to design traps — this is where real learning happens.',
    trap_name_ph: 'Trap name',
    trap_desc_ph: 'How students typically fall into it',
    trap_learning_ph: 'What they learn from falling in',
    section_student_role: '👤 Student Role',
    sr_name: 'Role',
    sr_name_ph:
      'e.g., Junior lawyer / Triage nurse / Social work intern…',
    sr_desc: 'Description',
    sr_starting: 'Starting Info (what the student knows at the start)',
    sr_starting_ph:
      "The info the student is given when the scenario opens — this shapes difficulty and fairness",
    section_agents: '👥 AI Characters (NPCs)',
    agent_unnamed: 'Unnamed character',
    agent_name: 'Name',
    agent_role: 'Role',
    agent_avatar: 'Avatar (emoji)',
    agent_persona: 'Persona',
    agent_knowledge: '🎯 Knowledge boundary (only what this NPC knows)',
    agent_knowledge_ph:
      'Only knowledge this NPC has. The evaluator uses this to detect hallucinations.',
    agent_hidden: "🤫 Hidden goals (others don't see this)",
    agent_guardrails: '🚧 Guardrails (never do/say)',
    agent_guardrail_ph: 'e.g., Never volunteer the diagnosis…',
    agent_delete: 'Delete this character',
    add_agent: '+ Add Character',
    section_rubric: '📋 Rubric',
    rubric_name_ph: 'Criterion name, e.g., Communication',
    rubric_desc_ph: 'Criterion description',
    rubric_indicators_ph: 'Observable indicators',
    add_rubric: '+ Add Criterion',
    section_opening_end: '🏁 Opening & End Conditions',
    opening_label: 'Opening beat (narrator or first speaker)',
    max_turns_label: 'Max turns',
    end_conditions_label: 'End conditions',
    end_conditions_ph: 'e.g., Student states a diagnosis',
    section_review: '🔁 Review Strategy',
    review_ph:
      'How should students consolidate afterwards? e.g., Write a SBAR handoff / Answer 3 reflection questions…',
    list_add_hint: 'Type and press Enter to add',
    list_add_default: 'Add another',
    scenario_not_found: 'Scenario not found',
    back_home: 'Back to home',
    first_visit_trigger:
      "(The teacher just opened the studio and hasn't said anything yet. Please greet them, introduce yourself, and ask the first icebreaker question.)",

    // ─── Run page ───
    back_to_design: '← Back to design',
    tab_live: '👤 Self Playtest',
    tab_simulate: '🤖 Simulated Students',
    tab_history: '📜 History ({n})',

    live_title: 'Play as the student — run the scenario yourself',
    live_subtitle:
      "You'll play {role} and talk with {n} AI characters",
    role_student: 'Student',
    start: '▶️ Start',
    end_manual: '⏹ End manually',
    restart: '🔄 Restart',
    empty_live:
      'Click [Start] to run the scenario.\nThe AI characters will interact with you.',
    ai_thinking: 'AI character is thinking…',
    scenario_ended: 'Scenario ended',
    student_input_ph: 'Reply as {role}…',
    generate_eval: '📊 Generate Evaluation',
    generating_eval: 'Evaluating…',
    eval_failed: 'Evaluation failed: {msg}',
    run_failed: 'Run failed: {msg}',
    teacher_self: 'Teacher (me)',
    end_by_teacher: 'Ended by teacher',

    sim_title: 'Pick simulated student personas to auto-run the scenario',
    sim_subtitle:
      'Select one or more. Each persona will run the scenario independently and get evaluated. Goal: stress-test the scenario against diverse student behaviors.',
    run_selected: '▶️ Run {n} selected student(s)',
    sim_running: 'Running… ({name})',
    sim_time_hint: 'About 30-90 seconds per student',
    sim_failed: '{name} failed: {msg}',

    end_reason_normal: 'Ended normally',

    matrix_title: '📊 Test Matrix',
    col_student: 'Student',
    col_performance: 'Performance',
    col_fidelity: 'Agent Fidelity',
    col_hallu: 'Hallucinations',
    col_issues: 'Design Issues',
    col_end_reason: 'End Reason',
    eval_fail_row: 'Evaluation failed',
    result_title: '{avatar} {name} — Run Results',
    view_full_convo: '📝 View full transcript ({n} messages)',
    eval_gen_failed: 'Evaluation generation failed',

    empty_history:
      'No runs yet. Go to [Self Playtest] or [Simulated Students] to try one.',
    conversation_log: 'Transcript ({n} messages)',
    history_scenario_version: 'scenario v{v} · {time}',
    history_score: 'Score: {s}/100',
    history_select_hint: 'Select a session from the left to see details',

    eval_overall_score: 'Overall Score',
    eval_verdict_title: 'Overall Verdict',
    eval_student_perf: '👤 Student Performance',
    eval_strengths: '✅ Strengths',
    eval_weaknesses: '⚠️ Needs improvement',
    eval_feedback: '💬 Feedback',
    eval_traps_triggered: '⚠️ Traps triggered (likely learned)',
    eval_traps_missed: 'Traps missed',
    eval_fidelity: '🎭 Agent Role Fidelity',
    eval_hallucinations: '🧠 Hallucinations',
    no_hallucinations: 'No hallucinations detected ✨',
    hallu_said: 'Said: "{claim}"',
    hallu_evidence: 'Evidence: {ev}',
    eval_design_issues: '🔧 Scenario Design Issues',
    no_design_issues: 'Scenario design looks solid.',
    design_suggestion: '💡 Suggestion: {s}',
    narrator: 'Narrator',
    you_as: 'You ({role})',
    simulated_as: '{name} (as {role})',
    end_reason_director: 'Director decided to end',
    end_reason_student: 'Student ended conversation',
    end_reason_max_turns: 'Max turns reached',
    end_reason_no_agent: 'agent not found',

    // ─── API Key Settings ───
    settings: '⚙ Settings',
    apikey_title: '🔑 Gemini API Key',
    apikey_desc:
      'This app uses Google Gemini. You need a free API key to run it.',
    apikey_get_hint: "Don't have one? Get one from",
    apikey_get_link: 'Google AI Studio',
    apikey_get_suffix: ' (takes ~1 min, free)',
    apikey_input_ph: 'Paste your Gemini API key (starts with AIza)',
    apikey_privacy:
      "🔒 Your key is stored only in your own browser (LocalStorage). It is never sent to any third-party server — every call goes directly from your browser's session to Google.",
    apikey_save: 'Save',
    apikey_clear: 'Clear key',
    apikey_saved: '✅ Saved',
    apikey_status_set: 'Set (starts with {prefix})',
    apikey_status_unset: '❗ Not set',
    apikey_banner_missing:
      '👋 Before you start, set your Gemini API key — ',
    apikey_banner_cta: 'click here to set it',
    apikey_missing_error:
      'Please set your Gemini API key first (top-right Settings ⚙)',

    // ─── Stage / Multimodal ───
    stage_scene_label: 'Scene',
    stage_scene_image_label: 'Scene image',
    stage_scene_ready: 'Scene stage · click Start to enter',
    stage_generate_scene: '🎨 Generate scene image',
    stage_regenerate_scene: '🔄 Regenerate scene',
    stage_generate_avatars: '🎭 Generate NPC avatars',
    stage_tts_on: '🔊 Voice: on',
    stage_tts_off: '🔇 Voice: off',
    stage_generating_scene: 'Painting scene…',
    stage_generating_avatars: 'Painting avatars…',
    stage_media_failed: 'Media generation failed: {msg}',
    stage_retry: '↻ Retry',
    stage_scene_hint: 'Optional: generate a backdrop image so the roleplay feels more vivid',
    stage_avatars_hint: 'Optional: generate photorealistic NPC avatars (replaces emoji)',
    stage_tts_hint: "Click ▶ next to a message to hear the AI voice",

    // ─── Iteration loop (Refine) ───
    refine_cta: '🔁 Refine scenario from this evaluation',
    refine_cta_multi: '🔁 Refine scenario from all {n} evaluations',
    refine_running: 'Pedagogy specialist is analyzing the evidence…',
    refine_failed: 'Scenario refinement failed: {msg}',
    refine_modal_title: 'Scenario Upgrade Proposal',
    refine_summary_label: 'Summary',
    refine_changes_label: 'Specific changes',
    refine_apply: '✅ Apply to scenario (version +1)',
    refine_apply_and_run: '✅ Apply and re-run now',
    refine_dismiss: 'Not now',
    refine_applied_toast: 'Scenario upgraded to v{v}. Next run will use the new version.',
    refine_elapsed: '{s}s elapsed…',
    refine_timeout:
      'Request did not respond within 90s. Gemini may be slow or the network is flaky — please try again.',
    refine_no_changes_title: 'No actionable changes proposed',
    refine_no_changes_body:
      "The pedagogy specialist reviewed the evaluation but **did not propose** any concrete scenario changes this round. The run may already cover the key challenges, or there isn't enough evidence yet to justify a change. Try running more simulated students to gather more evidence, then come back.",
    refine_no_changes_ok: 'OK',
    refine_diff_heading: 'Fields that will change',
    refine_diff_none: '(No field-level changes — only the version bumps)',
    refine_diff_field: '{name}',
    refine_applied_banner_title: '✅ Scenario upgraded to v{v}',
    refine_applied_banner_fields: 'Fields actually changed: {list}',
    refine_applied_banner_nofields:
      'The specialist proposed narrative changes, but no structural field was actually modified — version is still v{v}.',
    refine_applied_banner_close: 'Dismiss',

    // ─── Export / Prompt Library ───
    export_modal_title: 'Export Scenario Prompts',
    export_modal_sub:
      'These two prompts are teacher-owned assets — paste them into any LLM (ChatGPT / Claude / Gemini) to reuse.',
    export_kind_scenario: '🎭 Scenario Prompt (run the scenario on any LLM)',
    export_kind_evaluation: '📊 Evaluation Prompt (grade the student with any LLM)',
    export_download_txt: '⬇ Download .txt',
    export_copy: '📋 Copy',
    export_copied: 'Copied',
    export_save_library: '💾 Save to library',
    export_saved_library: 'Saved ✓',
    export_preview: 'Preview',
    export_close: 'Close',

    library_button: '📚 Prompt Library',
    library_title: '📚 My Prompt Library',
    library_subtitle:
      'All your exported scenario / evaluation prompts live here — copy, download, or rename anytime.',
    library_empty:
      "You haven't saved any prompts yet. Go to a scenario → [📥 Export] → [💾 Save to library].",
    library_filter_all: 'All',
    library_filter_scenario: 'Scenario',
    library_filter_evaluation: 'Evaluation',
    library_rename_ph: 'Give it a name',
    library_from_scenario: 'From "{title}" v{v}',
    library_saved_at: 'Saved {time}',
    library_confirm_delete: 'Delete "{name}"?',
    library_type_scenario: '🎭 Scenario',
    library_type_evaluation: '📊 Evaluation',

    // ─── History & version labelling ───
    history_ran_on_version: 'ran on v{v}',
    history_current_version: 'Scenario is now v{v}',
    history_version_mismatch:
      '⚠️ This session used v{sv} — scenario has since been upgraded to v{cv}. The "Refine from this evaluation" below will produce another patch on top of v{cv}.',
    history_refine_title: 'Refine scenario from this session',
    history_refine_sub:
      "Feed this session's evidence to the pedagogy specialist to produce a new scenarioPatch.",
    history_rerun_current: '▶ Re-run on current v{v} (Live)',
    history_rerun_sim: '▶ Re-run on current v{v} (Simulate)',
    running_on_version: 'Running version: v{v}',
    sim_result_version: '{name} · ran on v{v}',

    // ─── Document view (right pane, Word-doc style editor) ───
    doc_title_ph: 'Scenario title…',
    doc_discipline_ph: 'Discipline',
    doc_learners_ph:
      'Target learners (e.g., 3rd-year nursing students who completed emergency-care)',
    doc_section_context: 'Scenario Context',
    doc_context_ph:
      "Set the scene — time, place, trigger. Write it like a short narrative so the picture is vivid. E.g., 'Friday afternoon, 4:20pm, the triage station. An anxious woman pushes a wheelchair in…'",
    doc_section_objectives: 'Learning Objectives',
    doc_objective_ph: 'e.g., Recognize early signs of sepsis',
    doc_add_objective: 'Add a learning objective',
    doc_section_knowledge: 'Key Knowledge Points',
    doc_knowledge_ph: 'e.g., The three components of the qSOFA score',
    doc_add_knowledge: 'Add a knowledge point',
    doc_section_traps: 'Pedagogical Traps',
    doc_traps_hint:
      "Students have to stumble here for real learning to happen. Ask the Pedagogy Specialist to design these — don't soften them.",
    doc_trap_label: 'Trap {i}',
    doc_trap_name_ph: 'Short name, e.g., "Let the family emotion derail triage"',
    doc_trap_desc_ph:
      'How do students typically fall into this? What cues will lead them there?',
    doc_trap_learning_label: '→ What they learn',
    doc_trap_learning_ph:
      'e.g., Hold clinical priorities under high-emotion pressure',
    doc_add_trap: 'Add a pedagogical trap',
    doc_section_student: "Student's Role",
    doc_student_role_prefix: 'Role:',
    doc_student_name_ph: 'e.g., Triage nurse',
    doc_student_desc_ph: 'Who is the student playing? Background?',
    doc_student_starting_label: 'What the student knows at the opening',
    doc_student_starting_ph:
      "What the student sees/hears/has in hand at turn zero — this sets difficulty and fairness",
    doc_section_agents: 'AI Characters (NPCs)',
    doc_agent_name_ph: 'Character name',
    doc_agent_role_ph: 'Role, e.g., "Anxious daughter"',
    doc_agent_persona_label: 'Persona',
    doc_agent_persona_ph:
      'Personality, background, speech pattern, emotional baseline',
    doc_agent_knowledge_label: 'Knowledge boundary',
    doc_agent_knowledge_hint:
      'This NPC only knows the following — anything beyond counts as hallucination',
    doc_agent_knowledge_ph:
      'Spell out what this NPC should and should not know',
    doc_agent_hidden_label: 'Hidden goals',
    doc_agent_hidden_hint:
      "Others don't see it, but it shapes every choice this NPC makes",
    doc_agent_hidden_ph:
      "e.g., Afraid of being blamed, so instinctively dodges certain questions",
    doc_agent_guardrails_label: 'Guardrails',
    doc_agent_guardrails_hint: 'Things this NPC must never do/say',
    doc_agent_guardrail_ph: 'e.g., Never volunteer a diagnosis',
    doc_add_guardrail: 'Add a guardrail',
    doc_add_agent: 'Add an NPC',
    doc_section_opening: 'Opening Beat',
    doc_opening_ph:
      'How the scenario opens — a line of narration or what the first NPC says',
    doc_section_flow: 'Flow & End Conditions',
    doc_max_turns_label: 'Max turns:',
    doc_max_turns_hint: 'Scenario auto-ends past this',
    doc_end_conditions_label: 'End when ANY of the following triggers',
    doc_end_condition_ph: 'e.g., Student states a diagnosis',
    doc_add_end_condition: 'Add an end condition',
    doc_section_rubric: 'Evaluation Rubric',
    doc_rubric_name_ph: 'Criterion, e.g., "Clinical judgment"',
    doc_rubric_desc_ph: 'What does this criterion assess?',
    doc_rubric_indicators_label:
      'Observable indicators (behaviors visible in the transcript)',
    doc_rubric_indicator_ph: 'e.g., Proactively asks about medical history',
    doc_add_indicator: 'Add an indicator',
    doc_add_rubric: 'Add a rubric criterion',
    doc_section_review: 'Review Strategy',
    doc_review_ph:
      "How should the student consolidate afterwards? e.g., Write an SBAR handoff / answer 3 reflection questions",
    doc_footer_hint:
      "This document is the single source of truth for the scenario. Every self-playtest, simulated student, evaluation, and export uses exactly what's written here. Chatting with the Pedagogy Specialist on the left edits this document automatically — or you can type here directly.",

    // Extensible custom sections
    doc_add_custom_heading: 'Grow this lesson document',
    doc_add_custom_hint:
      "If the fixed structure above doesn't fit — e.g., you want a 'Scene 2', pre-reading, branching path, debrief ritual — add a new section here. The Pedagogy Specialist will also append sections as the conversation develops.",
    doc_add_custom_slate: 'Plain section',
    doc_add_custom_blue: 'Goals / intent',
    doc_add_custom_teal: 'Knowledge / materials',
    doc_add_custom_amber: 'Challenges / risks',
    doc_add_custom_indigo: 'Student-related',
    doc_add_custom_violet: 'NPC / scene',
    doc_add_custom_rose: 'Reflection / warnings',
    doc_custom_title_ph: 'Section title, e.g., Scene 2 · Family Waiting Area',
    doc_custom_body_ph:
      "Write freely here — describe what happens in this segment, what you want the student to experience, any extra rules…",
    doc_custom_move_up: 'Move up',
    doc_custom_move_down: 'Move down',
    doc_custom_remove: 'Remove this section',
  },
} as const;

export type TKey = keyof typeof dict.zh;

function interpolate(s: string, vars?: Record<string, string | number>) {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
}

export function t(
  locale: Locale,
  key: TKey,
  vars?: Record<string, string | number>
): string {
  const s = (dict[locale] as any)[key] ?? (dict.zh as any)[key] ?? key;
  return interpolate(s as string, vars);
}

/** 给 prompt 里用的语言名 */
export function languageLabel(locale: Locale): string {
  return locale === 'en' ? 'English' : 'Simplified Chinese (简体中文)';
}
