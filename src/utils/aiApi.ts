import { fetchEventSource } from '@microsoft/fetch-event-source';
import type { PageSchema } from '../types/schema';

export interface AiTemplateApiResult {
  ok: boolean;
  mode: 'generate' | 'refine';
  summary: string;
  suggestions: string[];
  schema: PageSchema;
  responseId?: string;
  model?: string;
  message?: string;
}

export interface AiChatApiResult {
  ok: boolean;
  reply: string;
  intent: 'chat' | 'generate' | 'refine';
  actionPrompt: string;
  responseId?: string;
  model?: string;
  message?: string;
}

interface GeneratePayload {
  prompt: string;
  previousResponseId?: string | null;
}

interface RefinePayload extends GeneratePayload {
  baseSchema: PageSchema;
}

interface ChatPayload {
  message: string;
  currentSchema?: PageSchema | null;
  previousResponseId?: string | null;
  conversationHistory?: Array<{
    role: 'assistant' | 'user';
    text: string;
  }>;
}

interface StreamHandlers<TResult> {
  onStatus?: (text: string) => void;
  onReplyDelta?: (text: string) => void;
  onResult?: (result: TResult) => void;
}

interface StreamOptions {
  signal?: AbortSignal;
}

async function postJson<TBody, TResult>(url: string, body: TBody): Promise<TResult> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as TResult & { message?: string };
  if (!response.ok) {
    throw new Error(data.message || 'AI 请求失败。');
  }

  return data;
}

async function readErrorMessage(response: Response) {
  const fallback = await response.json().catch(() => ({ message: 'AI 请求失败。' }));
  return fallback.message || 'AI 请求失败。';
}

async function postSse<TBody, TResult>(
  url: string,
  body: TBody,
  handlers: StreamHandlers<TResult>,
  options: StreamOptions = {},
): Promise<TResult> {
  let finalResult: TResult | null = null;

  await fetchEventSource(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal: options.signal,
    openWhenHidden: true,
    async onopen(response) {
      if (response.ok && response.body) {
        return;
      }

      throw new Error(await readErrorMessage(response));
    },
    onmessage(event) {
      if (!event.data || event.event === 'done') {
        return;
      }

      let payload: unknown;
      try {
        payload = JSON.parse(event.data);
      } catch {
        throw new Error('AI 流式响应解析失败。');
      }

      if (event.event === 'status') {
        handlers.onStatus?.((payload as { text?: string }).text || '');
        return;
      }

      if (event.event === 'reply_delta') {
        handlers.onReplyDelta?.((payload as { text?: string }).text || '');
        return;
      }

      if (event.event === 'result') {
        finalResult = payload as TResult;
        handlers.onResult?.(finalResult);
        return;
      }

      if (event.event === 'error') {
        throw new Error((payload as { message?: string }).message || 'AI 流式请求失败。');
      }
    },
    onclose() {
      if (!finalResult) {
        throw new Error('AI 流式请求未返回最终结果。');
      }
    },
    onerror(error) {
      throw error;
    },
  });

  if (!finalResult) {
    throw new Error('AI 流式请求未返回最终结果。');
  }

  return finalResult;
}

export function generateTemplateByAI(payload: GeneratePayload) {
  return postJson<GeneratePayload, AiTemplateApiResult>('/api/ai/template/generate', payload);
}

export function generateTemplateByAIStream(
  payload: GeneratePayload,
  handlers: StreamHandlers<AiTemplateApiResult>,
  options?: StreamOptions,
) {
  return postSse<GeneratePayload, AiTemplateApiResult>('/api/ai/template/generate', payload, handlers, options);
}

export function chatTemplateByAI(payload: ChatPayload) {
  return postJson<ChatPayload, AiChatApiResult>('/api/ai/template/chat', payload);
}

export function chatTemplateByAIStream(
  payload: ChatPayload,
  handlers: StreamHandlers<AiChatApiResult>,
  options?: StreamOptions,
) {
  return postSse<ChatPayload, AiChatApiResult>('/api/ai/template/chat', payload, handlers, options);
}

export function refineTemplateByAI(payload: RefinePayload) {
  return postJson<RefinePayload, AiTemplateApiResult>('/api/ai/template/refine', payload);
}

export function refineTemplateByAIStream(
  payload: RefinePayload,
  handlers: StreamHandlers<AiTemplateApiResult>,
  options?: StreamOptions,
) {
  return postSse<RefinePayload, AiTemplateApiResult>('/api/ai/template/refine', payload, handlers, options);
}
