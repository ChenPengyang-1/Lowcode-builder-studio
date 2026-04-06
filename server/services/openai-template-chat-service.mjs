import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import {
  buildChatDecisionMessages,
  buildChatMessages,
  buildChatReplyMessages,
} from '../prompts/template-prompts.mjs';
import {
  chatTemplateWithCompatibleChat,
  streamChatTemplateWithCompatibleChat,
} from './compat-chat-completions.mjs';

const model =
  process.env.AI_CHAT_MODEL ||
  process.env.OPENAI_CHAT_MODEL ||
  process.env.OPENAI_MODEL ||
  'gpt-4.1-mini';
const baseURL = process.env.OPENAI_BASE_URL;
const apiStyle =
  process.env.OPENAI_API_STYLE ||
  (baseURL ? 'chat-completions' : model.toLowerCase().includes('claude') ? 'chat-completions' : 'responses');
const client = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      baseURL: baseURL || undefined,
      timeout: 90000,
    })
  : null;

const templateChatDecisionFormatName = 'template_chat_decision';
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

function getParsedOutput(response) {
  return (
    response.output_parsed ??
    response.output?.[0]?.content?.find((item) => item.type === 'output_text')?.parsed ??
    null
  );
}

function extractReplyText(response) {
  return (
    response.output_text?.trim() ??
    response.output?.[0]?.content?.find((item) => item.type === 'output_text')?.text?.trim() ??
    ''
  );
}

export async function chatTemplateWithAI({ message, previousResponseId, currentSchema, conversationHistory }) {
  ensureClient();
  if (apiStyle === 'chat-completions') {
    return chatTemplateWithCompatibleChat({ message, previousResponseId, currentSchema, conversationHistory });
  }

  const response = await client.responses.parse({
    model,
    input: buildChatMessages(message, currentSchema, conversationHistory),
    previous_response_id: previousResponseId || undefined,
    max_output_tokens: 220,
    text: {
      format: zodTextFormat(templateChatDecisionSchema, templateChatDecisionFormatName),
    },
  });

  const parsed = getParsedOutput(response);
  if (!parsed) {
    const error = new Error('AI 没有返回可解析的对话结果。');
    error.statusCode = 502;
    throw error;
  }

  return {
    ok: true,
    reply: parsed.reply,
    intent: parsed.intent,
    actionPrompt: parsed.intent === 'chat' ? '' : parsed.actionPrompt,
    responseId: response.id,
    model,
  };
}

export async function streamChatTemplateWithAI({
  message,
  previousResponseId,
  currentSchema,
  conversationHistory,
  onTextDelta,
}) {
  ensureClient();
  if (apiStyle === 'chat-completions') {
    return streamChatTemplateWithCompatibleChat({
      message,
      previousResponseId,
      currentSchema,
      conversationHistory,
      onTextDelta,
    });
  }

  const stream = client.responses.stream({
    model,
    input: buildChatReplyMessages(message, currentSchema, conversationHistory),
    previous_response_id: previousResponseId || undefined,
    max_output_tokens: 260,
  });

  stream.on('response.output_text.delta', (event) => {
    onTextDelta?.(event.delta);
  });

  const streamedResponse = await stream.finalResponse();
  const reply = extractReplyText(streamedResponse);

  if (!reply) {
    const error = new Error('AI 没有返回有效的聊天内容。');
    error.statusCode = 502;
    throw error;
  }

  const decisionResponse = await client.responses.parse({
    model,
    input: buildChatDecisionMessages(message, currentSchema, reply, conversationHistory),
    previous_response_id: streamedResponse.id || previousResponseId || undefined,
    max_output_tokens: 120,
    text: {
      format: zodTextFormat(templateChatDecisionSchema, templateChatDecisionFormatName),
    },
  });

  const parsed = getParsedOutput(decisionResponse);
  if (!parsed) {
    const error = new Error('AI 没有返回可解析的对话结果。');
    error.statusCode = 502;
    throw error;
  }

  return {
    ok: true,
    reply,
    intent: parsed.intent,
    actionPrompt: parsed.intent === 'chat' ? '' : parsed.actionPrompt,
    responseId: decisionResponse.id || streamedResponse.id,
    model,
  };
}

