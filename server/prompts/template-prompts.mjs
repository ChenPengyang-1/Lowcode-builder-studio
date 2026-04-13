import { supportedSectionTypes } from '../shared/template-blueprint.mjs';

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const blueprintSkillPath = path.join(currentDir, 'blueprint-skill.md');
const blueprintSkillContent = fs.readFileSync(blueprintSkillPath, 'utf8').trim();

function commonRules() {
  return [
    blueprintSkillContent,
    '你是低代码页面搭建平台的 AI 模板助手。',
    '你的任务是根据用户需求生成或修改页面蓝图，再由系统把蓝图映射成真实 Schema。',
    `当前只允许使用这些区块类型：${supportedSectionTypes.join('、')}。`,
    '输出必须严格符合结构化格式，不要输出额外解释。',
    '页面应尽量完整，通常包含首屏、内容区块和转化区块。',
    '如果用户需求偏模糊，请在结果中尽量做合理补充，但不要生成不存在的组件类型。',
  ].join('\n');
}

function blueprintExample() {
  return JSON.stringify(
    {
      pageTitle: '社团迎新页面',
      pageDescription: '用于展示社团特色、活动图片和报名入口的迎新页面。',
      backgroundTone: 'blue',
      summary: '页面包含社团介绍、活动亮点、图片展示和报名表单，适合迎新招募场景。',
      suggestions: ['可以补充社团成员介绍', '可以增加常见问题'],
      sections: [
        {
          kind: 'hero',
          title: '加入我们，一起开启精彩社团生活',
          subtitle: '展示社团氛围、活动亮点和招新入口',
          note: '适合迎新季招募展示',
          ctaText: '立即报名',
          visualTone: 'brand',
        },
        {
          kind: 'image',
          alt: '社团活动合照',
          imageTheme: 'generic',
          aspect: 'banner',
        },
        {
          kind: 'feature-list',
          title: '为什么选择我们',
          items: ['活动丰富', '成员氛围好', '成长机会多'],
        },
        {
          kind: 'form',
          title: '填写报名信息',
          buttonText: '提交报名',
          fields: [
            {
              label: '姓名',
              type: 'text',
              placeholder: '请输入姓名',
              required: true,
              options: [],
            },
            {
              label: '手机号',
              type: 'tel',
              placeholder: '请输入手机号',
              required: true,
              options: [],
            },
          ],
        },
      ],
    },
    null,
    2,
  );
}

function summarizeSchemaForBlueprint(baseSchema) {
  if (!baseSchema || typeof baseSchema !== 'object') {
    return '当前没有可用的页面结构摘要。';
  }

  const pageMeta = baseSchema.pageMeta ?? {};
  const nodes = Array.isArray(baseSchema.nodes) ? baseSchema.nodes : [];

  const nodeSummaries = nodes.slice(0, 10).map((node, index) => {
    const type = node?.type ?? 'unknown';
    const name = node?.name ?? `区块${index + 1}`;
    const props = node?.props ?? {};

    const keyInfo = [];
    if (typeof props.title === 'string') keyInfo.push(`title=${props.title}`);
    if (typeof props.subtitle === 'string') keyInfo.push(`subtitle=${props.subtitle}`);
    if (typeof props.text === 'string') keyInfo.push(`text=${props.text}`);
    if (typeof props.alt === 'string') keyInfo.push(`alt=${props.alt}`);
    if (Array.isArray(props.fields)) keyInfo.push(`fields=${props.fields.length}`);

    return `- ${type} | ${name}${keyInfo.length ? ` | ${keyInfo.join(', ')}` : ''}`;
  });

  return [
    `页面标题：${pageMeta.title ?? ''}`,
    `页面描述：${pageMeta.description ?? ''}`,
    '当前页面区块概况：',
    nodeSummaries.length ? nodeSummaries.join('\n') : '- 暂无区块',
  ].join('\n');
}

function formatConversationHistory(conversationHistory) {
  if (!Array.isArray(conversationHistory) || !conversationHistory.length) {
    return '当前还没有更早的对话历史。';
  }

  return conversationHistory
    .slice(-8)
    .map((message) => `${message.role === 'user' ? '用户' : '助手'}：${message.text}`)
    .join('\n');
}

export function buildChatMessages(message, currentSchema, conversationHistory) {
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
        '最近对话历史：',
        formatConversationHistory(conversationHistory),
        currentSchema
          ? ['当前已经有一版页面 Schema，可视为当前正在修改的页面：', JSON.stringify(currentSchema, null, 2)].join('\n')
          : '当前还没有生成出的页面结果。',
        '请根据下面这条用户消息继续对话：',
        message,
      ].join('\n'),
    },
  ];
}

export function buildChatReplyMessages(message, currentSchema, conversationHistory) {
  return [
    {
      role: 'system',
      content: [
        '你是低代码页面搭建平台里的对话式 AI 助手，要像 GPT 一样自然交流，帮助用户逐步明确页面目标。',
        '这一步只负责自然聊天回复，不负责输出结构化 JSON。',
        '如果用户只是提问、确认方向、补充需求、问你是什么模型或你能做什么，请正常回答。',
        '如果用户已经开始描述页面需求，请像产品搭建助手一样帮助用户确认目标、补充建议或提示下一步。',
        '回复要自然、简洁、有陪伴感，不要写成系统提示或表单引导语。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `当前平台支持的区块类型：${supportedSectionTypes.join('、')}。`,
        '最近对话历史：',
        formatConversationHistory(conversationHistory),
        currentSchema
          ? ['当前已经有一版页面 Schema，可视为当前正在修改的页面：', JSON.stringify(currentSchema, null, 2)].join('\n')
          : '当前还没有生成出的页面结果。',
        '请根据下面这条用户消息继续对话：',
        message,
      ].join('\n'),
    },
  ];
}

export function buildChatDecisionMessages(message, currentSchema, reply, conversationHistory) {
  return [
    {
      role: 'system',
      content: [
        '你是低代码页面搭建平台里的对话式 AI 助手，要根据用户输入和已经给出的回复，判断下一步动作。',
        '你要返回结构化结果：reply、intent、actionPrompt。',
        'intent 只能是 chat、generate、refine 三种之一。',
        '如果用户只是提问、确认方向、补充需求、闲聊、问你是什么模型或你能做什么，intent 设为 chat。',
        '如果用户已经明确要你开始生成一版页面，intent 才设为 generate。',
        '如果当前已经有页面结果，且用户明确要你基于当前结果继续修改，intent 才设为 refine。',
        '当 intent 为 generate 或 refine 时，actionPrompt 需要整理成一段完整、清晰、适合后续结构化生成或修改的中文指令；当 intent 为 chat 时，actionPrompt 设为空字符串。',
        'reply 请原样返回，不要改写。',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `当前平台支持的区块类型：${supportedSectionTypes.join('、')}。`,
        '最近对话历史：',
        formatConversationHistory(conversationHistory),
        currentSchema
          ? ['当前已经有一版页面 Schema，可视为当前正在修改的页面：', JSON.stringify(currentSchema, null, 2)].join('\n')
          : '当前还没有生成出的页面结果。',
        '用户原始消息：',
        message,
        '你已经给出的回复：',
        reply,
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
          '请先判断最适合的页面场景，再在允许的区块和字段范围内输出。',
          '请确保返回内容适合营销页、活动页、报名页或产品介绍页这类低代码落地页场景。',
          '请严格参考下面这个 JSON 结构示例来输出，字段名必须保持一致，sections 中只能使用允许的 kind。',
          blueprintExample(),
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
        '下面是当前页面的摘要，请先理解当前页面结构，再根据我的要求返回一份新的完整页面蓝图。',
          '当前页面摘要：',
          summarizeSchemaForBlueprint(baseSchema),
          '修改要求：',
          prompt,
          '请优先保留当前页面中合理的结构，只修改必要的部分。',
          '要求：保留合理的已有结构，只在必要处调整；如果用户明确要求新增模块，可以补充新的模块。',
          '请严格参考下面这个 JSON 结构示例来输出，字段名必须保持一致，sections 中只能使用允许的 kind。',
          blueprintExample(),
      ].join('\n'),
    },
  ];
}
