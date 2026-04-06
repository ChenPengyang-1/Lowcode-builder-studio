import OpenAI from 'openai';
import { z } from 'zod';
import {
  buildChatDecisionMessages,
  buildChatReplyMessages,
} from '../prompts/template-prompts.mjs';

const model =
  process.env.AI_CHAT_MODEL ||
  process.env.OPENAI_CHAT_MODEL ||
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

const templateChatDecisionSchema = z.object({
  reply: z.string().min(1),
  intent: z.enum(['chat', 'generate', 'refine']),
  actionPrompt: z.string(),
});

function ensureClient() {
  if (!client) {
    const error = new Error('OPENAI_API_KEY 未配置，无法调用真实 AI 服务。');
    error.statusCode = 500;
    throw error;
  }
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
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
      content: '请只返回一个合法 JSON 对象，不要输出 Markdown 代码块或其他说明。',
    },
  ];
}

function inferDecisionFromMessage(message, currentSchema, reply) {
  const normalized = normalizeText(message);
  const hasExistingSchema = Boolean(currentSchema && Array.isArray(currentSchema.nodes) && currentSchema.nodes.length);

  const refineKeywords = ['修改', '优化', '调整', '改一下', '改成', '换成', '再加', '增加', '补充', '丰富', '细化'];
  const generateKeywords = ['开始生成', '生成一版', '生成页面', '开始构建', '生成一个', '帮我生成', '直接生成', '开始做'];

  const isRefine = hasExistingSchema && refineKeywords.some((keyword) => normalized.includes(keyword));
  const isGenerate = !isRefine && generateKeywords.some((keyword) => normalized.includes(keyword));
  const intent = isRefine ? 'refine' : isGenerate ? 'generate' : 'chat';

  return {
    parsed: {
      reply,
      intent,
      actionPrompt: intent === 'chat' ? '' : message.trim(),
    },
    responseId: '',
  };
}

async function createChatCompletion(messages, options = {}) {
  ensureClient();
  return client.chat.completions.create({
    model,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: options.maxTokens ?? 280,
    ...(options.forceJson ? { response_format: { type: 'json_object' } } : {}),
    stream: false,
  });
}

async function createDecision(message, currentSchema, reply, conversationHistory) {
  const completion = await createChatCompletion(
    withJsonOnlyInstruction(buildChatDecisionMessages(message, currentSchema, reply, conversationHistory)),
    { temperature: 0, maxTokens: 180, forceJson: true },
  );

  const completionText = extractCompletionText(completion);
  let payload = null;

  try {
    payload = extractJsonPayload(completionText);
  } catch (_error) {
    return inferDecisionFromMessage(message, currentSchema, reply);
  }

  const parsed = templateChatDecisionSchema.safeParse(payload);
  if (!parsed.success) {
    return inferDecisionFromMessage(message, currentSchema, reply);
  }

  return {
    parsed: parsed.data,
    responseId: completion.id,
  };
}

export async function chatTemplateWithCompatibleChat({ message, currentSchema, conversationHistory }) {
  const replyCompletion = await createChatCompletion(buildChatReplyMessages(message, currentSchema, conversationHistory), {
    temperature: 0.7,
    maxTokens: 320,
  });
  const reply = extractCompletionText(replyCompletion);
  if (!reply) {
    const error = new Error('AI 没有返回有效的聊天内容。');
    error.statusCode = 502;
    throw error;
  }

  const decision = await createDecision(message, currentSchema, reply, conversationHistory);
  return {
    ok: true,
    reply,
    intent: decision.parsed.intent,
    actionPrompt: decision.parsed.intent === 'chat' ? '' : decision.parsed.actionPrompt,
    responseId: decision.responseId || replyCompletion.id,
    model,
  };
}

export async function streamChatTemplateWithCompatibleChat({
  message,
  currentSchema,
  conversationHistory,
  onTextDelta,
}) {
  ensureClient();
  const stream = await client.chat.completions.create({
    model,
    messages: buildChatReplyMessages(message, currentSchema, conversationHistory),
    temperature: 0.7,
    max_tokens: 320,
    stream: true,
  });

  let reply = '';
  for await (const chunk of stream) {
    const delta = chunk?.choices?.[0]?.delta?.content;
    if (typeof delta === 'string') {
      reply += delta;
      onTextDelta?.(delta);
      continue;
    }
    if (Array.isArray(delta)) {
      const text = delta
        .map((item) => (item?.type === 'text' ? item.text ?? '' : ''))
        .join('');
      if (text) {
        reply += text;
        onTextDelta?.(text);
      }
    }
  }

  reply = reply.trim();
  if (!reply) {
    const error = new Error('AI 没有返回有效的聊天内容。');
    error.statusCode = 502;
    throw error;
  }

  const decision = await createDecision(message, currentSchema, reply, conversationHistory);
  return {
    ok: true,
    reply,
    intent: decision.parsed.intent,
    actionPrompt: decision.parsed.intent === 'chat' ? '' : decision.parsed.actionPrompt,
    responseId: decision.responseId,
    model,
  };
}
