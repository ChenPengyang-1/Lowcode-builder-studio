import OpenAI from 'openai';
import { templateBlueprintSchema } from '../shared/template-blueprint.mjs';
import { buildPageSchemaFromBlueprint } from '../utils/build-page-schema.mjs';
import { buildGenerateMessages, buildRefineMessages } from '../prompts/template-prompts.mjs';

const model =
  process.env.AI_REASONING_MODEL ||
  process.env.OPENAI_REASONING_MODEL ||
  process.env.OPENAI_MODEL ||
  'gpt-4.1-mini';

const baseURL = process.env.OPENAI_BASE_URL;

const client = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: baseURL || undefined,
      timeout: 90000,
    })
  : null;

function ensureClient() {
  if (!client) {
    const error = new Error('OPENAI_API_KEY 未配置，无法调用真实 AI 服务。');
    error.statusCode = 500;
    throw error;
  }
}

function extractCompletionText(completion) {
  const content = completion?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item?.type === 'text') return item.text ?? '';
        return '';
      })
      .join('')
      .trim();
  }
  return '';
}

function extractJsonPayload(text) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const candidate =
    firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
      ? cleaned.slice(firstBrace, lastBrace + 1)
      : cleaned;

  return JSON.parse(candidate);
}

function withJsonOnlyInstruction(messages) {
  return [
    ...messages,
    {
      role: 'system',
      content:
        '请只返回一个合法 JSON 对象，不要输出 Markdown 代码块或其他说明；输出内容必须满足 pageTitle、pageDescription、backgroundTone、summary、suggestions、sections 这些字段。',
    },
  ];
}

function createRepairMessages(rawText) {
  return [
    {
      role: 'system',
      content:
        '你是 JSON 修复助手。请把用户提供的内容修复为一个合法 JSON 对象，只返回 JSON 本身，不要输出任何解释、Markdown 或代码块。',
    },
    {
      role: 'user',
      content: [
        '请修复下面这段 JSON，让它成为一个合法 JSON 对象。',
        '如果存在缺少逗号、引号、数组结尾或多余说明文字，请自行修复。',
        '原始内容：',
        rawText,
      ].join('\n'),
    },
  ];
}

function createSchemaRepairMessages(rawText, issues) {
  return [
    {
      role: 'system',
      content:
        '你是低代码页面蓝图修复助手。请根据给定的校验错误，把内容修复成符合要求的合法 JSON 对象，只返回 JSON 本身，不要输出任何解释。',
    },
    {
      role: 'user',
      content: [
        '下面这段 JSON 已经接近正确，但还不满足目标 schema，请按错误提示修正。',
        '校验错误：',
        issues,
        '原始内容：',
        rawText,
      ].join('\n'),
    },
  ];
}

async function requestBlueprintWithChatCompletions(messages) {
  ensureClient();
  const completion = await client.chat.completions.create({
    model,
    messages: withJsonOnlyInstruction(messages),
    temperature: 0.2,
    max_tokens: 2200,
    response_format: { type: 'json_object' },
    stream: false,
  });

  const completionText = extractCompletionText(completion);
  let payload = null;

  try {
    payload = extractJsonPayload(completionText);
  } catch (_error) {
    const repairCompletion = await client.chat.completions.create({
      model,
      messages: createRepairMessages(completionText),
      temperature: 0,
      max_tokens: 2400,
      response_format: { type: 'json_object' },
      stream: false,
    });
    payload = extractJsonPayload(extractCompletionText(repairCompletion));
  }

  let parsed = templateBlueprintSchema.safeParse(payload);
  if (!parsed.success) {
    const repairBySchemaCompletion = await client.chat.completions.create({
      model,
      messages: createSchemaRepairMessages(
        JSON.stringify(payload, null, 2),
        JSON.stringify(parsed.error.issues, null, 2),
      ),
      temperature: 0,
      max_tokens: 2600,
      response_format: { type: 'json_object' },
      stream: false,
    });

    payload = extractJsonPayload(extractCompletionText(repairBySchemaCompletion));
    parsed = templateBlueprintSchema.safeParse(payload);
  }

  if (!parsed.success) {
    const error = new Error('AI 没有返回可解析的结构化结果。');
    error.statusCode = 502;
    throw error;
  }

  return {
    responseId: completion.id,
    blueprint: parsed.data,
    schema: buildPageSchemaFromBlueprint(parsed.data),
  };
}

export async function generateTemplateWithCompatibleChat({ prompt, previousResponseId: _previousResponseId }) {
  const result = await requestBlueprintWithChatCompletions(buildGenerateMessages(prompt));

  return {
    ok: true,
    mode: 'generate',
    summary: result.blueprint.summary,
    suggestions: result.blueprint.suggestions,
    schema: result.schema,
    responseId: result.responseId,
    model,
  };
}

export async function streamGenerateTemplateWithCompatibleChat({
  prompt,
  previousResponseId: _previousResponseId,
  onStatus,
}) {
  onStatus?.('正在整理你的需求，并规划页面结构...');
  const result = await requestBlueprintWithChatCompletions(buildGenerateMessages(prompt));
  onStatus?.('页面结构已经生成，正在映射为可编辑的 Schema...');

  return {
    ok: true,
    mode: 'generate',
    summary: result.blueprint.summary,
    suggestions: result.blueprint.suggestions,
    schema: result.schema,
    responseId: result.responseId,
    model,
  };
}

export async function refineTemplateWithCompatibleChat({
  prompt,
  baseSchema,
  previousResponseId: _previousResponseId,
}) {
  const result = await requestBlueprintWithChatCompletions(buildRefineMessages(prompt, baseSchema));

  return {
    ok: true,
    mode: 'refine',
    summary: result.blueprint.summary,
    suggestions: result.blueprint.suggestions,
    schema: result.schema,
    responseId: result.responseId,
    model,
  };
}

export async function streamRefineTemplateWithCompatibleChat({
  prompt,
  baseSchema,
  previousResponseId: _previousResponseId,
  onStatus,
}) {
  onStatus?.('正在理解当前页面，并组织修改方案...');
  const result = await requestBlueprintWithChatCompletions(buildRefineMessages(prompt, baseSchema));
  onStatus?.('页面结构已经生成，正在映射为可编辑的 Schema...');

  return {
    ok: true,
    mode: 'refine',
    summary: result.blueprint.summary,
    suggestions: result.blueprint.suggestions,
    schema: result.schema,
    responseId: result.responseId,
    model,
  };
}
