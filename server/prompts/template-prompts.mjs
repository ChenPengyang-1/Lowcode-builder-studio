import { supportedSectionTypes } from '../shared/template-blueprint.mjs';

function commonRules() {
  return [
    '你是低代码页面搭建平台的 AI 模板助手。',
    '你的任务是根据用户需求生成或修改页面蓝图，再由系统把蓝图映射成真实 Schema。',
    `当前只允许使用这些区块类型：${supportedSectionTypes.join('、')}。`,
    '输出必须严格符合结构化格式，不要输出额外解释。',
    '页面应尽量完整，通常包含首屏、内容区块和转化区块。',
    '如果用户需求偏模糊，请在结果中尽量做合理补充，但不要生成不存在的组件类型。',
  ].join('\n');
}

export function buildChatMessages(message, currentSchema) {
  return [
    {
      role: 'system',
      content: [
        '你是低代码页面搭建平台里的对话式 AI 助手，要像 GPT 一样自然交流，帮助用户逐步明确页面目标。',
        '你要先给出自然、像聊天一样的 reply，再判断这句话的意图 intent：chat、generate 或 refine。',
        '如果用户只是提问、确认方向、补充需求、闲聊、问你是什么模型或你能做什么，intent 设为 chat。',
        '如果用户已经明确要你开始生成一版页面，intent 才设为 generate。',
        '如果当前已经有页面结果，且用户明确要你基于当前结果继续修改，intent 才设为 refine。',
        '当 intent 为 generate 或 refine 时，actionPrompt 需要整理成一段完整、清晰、适合后续结构化生成或修改的中文指令；当 intent 为 chat 时，actionPrompt 设为空字符串。',
        'reply 要自然、简洁、有陪伴感，不要写成系统提示或表单引导语。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `当前平台支持的区块类型：${supportedSectionTypes.join('、')}。`,
        currentSchema
          ? ['当前已经有一版页面 Schema，可视为当前正在修改的页面：', JSON.stringify(currentSchema, null, 2)].join('\n')
          : '当前还没有生成出的页面结果。',
        '请根据下面这条用户消息继续对话：',
        message,
      ].join('\n'),
    },
  ];
}

export function buildGenerateMessages(prompt) {
  return [
    {
      role: 'system',
      content: commonRules(),
    },
    {
      role: 'user',
      content: [
        '请根据以下需求生成一份页面蓝图：',
        prompt,
        '请确保返回内容适合营销页、活动页、报名页或产品介绍页这类低代码落地页场景。',
      ].join('\n'),
    },
  ];
}

export function buildRefineMessages(prompt, baseSchema) {
  return [
    {
      role: 'system',
      content: commonRules(),
    },
    {
      role: 'user',
      content: [
        '下面是当前页面的 Schema，请先理解当前页面结构，再根据我的要求返回一份新的完整页面蓝图。',
        '当前页面 Schema：',
        JSON.stringify(baseSchema, null, 2),
        '修改要求：',
        prompt,
        '要求：保留合理的已有结构，只在必要处调整；如果用户明确要求新增模块，可以补充新的模块。',
      ].join('\n'),
    },
  ];
}
