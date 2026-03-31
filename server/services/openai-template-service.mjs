import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { templateBlueprintFormatName, templateBlueprintSchema } from '../shared/template-blueprint.mjs';
import { buildPageSchemaFromBlueprint } from '../utils/build-page-schema.mjs';
import { buildGenerateMessages, buildRefineMessages } from '../prompts/template-prompts.mjs';

const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const client = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 45000,
    })
  : null;

function ensureClient() {
  if (!client) {
    const error = new Error('OPENAI_API_KEY 未配置，无法调用真实 AI 服务。');
    error.statusCode = 500;
    throw error;
  }
}

function getParsedOutput(response) {
  return (
    response.output_parsed ??
    response.output?.[0]?.content?.find((item) => item.type === 'output_text')?.parsed ??
    null
  );
}

async function requestBlueprint(messages, previousResponseId) {
  ensureClient();

  const response = await client.responses.parse({
    model,
    input: messages,
    previous_response_id: previousResponseId || undefined,
    text: {
      format: zodTextFormat(templateBlueprintSchema, templateBlueprintFormatName),
    },
  });

  const parsed = getParsedOutput(response);
  if (!parsed) {
    const error = new Error('AI 没有返回可解析的结构化结果。');
    error.statusCode = 502;
    throw error;
  }

  return {
    responseId: response.id,
    blueprint: parsed,
    schema: buildPageSchemaFromBlueprint(parsed),
  };
}

async function requestBlueprintWithStatus(messages, previousResponseId, onStatus) {
  onStatus?.('正在整理你的需求，并规划页面结构...');
  const result = await requestBlueprint(messages, previousResponseId);
  onStatus?.('页面结构已经生成，正在映射为可编辑的 Schema...');
  return result;
}

export async function generateTemplateWithAI({ prompt, previousResponseId }) {
  const result = await requestBlueprint(buildGenerateMessages(prompt), previousResponseId);

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

export async function streamGenerateTemplateWithAI({ prompt, previousResponseId, onStatus }) {
  const result = await requestBlueprintWithStatus(
    buildGenerateMessages(prompt),
    previousResponseId,
    onStatus,
  );

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

export async function refineTemplateWithAI({ prompt, baseSchema, previousResponseId }) {
  const result = await requestBlueprint(
    buildRefineMessages(prompt, baseSchema),
    previousResponseId,
  );

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

export async function streamRefineTemplateWithAI({
  prompt,
  baseSchema,
  previousResponseId,
  onStatus,
}) {
  const result = await requestBlueprintWithStatus(
    buildRefineMessages(prompt, baseSchema),
    previousResponseId,
    onStatus,
  );

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
