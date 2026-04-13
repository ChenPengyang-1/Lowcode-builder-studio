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

interface SseEventPayload {
  event: string;
  data: unknown;
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

function parseSseChunk(chunk: string): SseEventPayload[] {
  return chunk
    .split('\n\n')
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block) => {
      const lines = block.split('\n');
      const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim() ?? 'message';
      const dataLine = lines.find((line) => line.startsWith('data:'))?.slice(5).trim() ?? '{}';

      try {
        return [{ event, data: JSON.parse(dataLine) }];
      } catch {
        return [];
      }
    });
}

async function postSse<TBody, TResult>(
  url: string,
  body: TBody,
  handlers: StreamHandlers<TResult>,
  options: StreamOptions = {},
): Promise<TResult> {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'text/event-stream',
    },
    body: JSON.stringify(body),
    signal: options.signal,
  });

  if (!response.ok || !response.body) {
    const fallback = await response.json().catch(() => ({ message: 'AI 请求失败。' }));
    throw new Error(fallback.message || 'AI 请求失败。');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buffer = '';
  let finalResult: TResult | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const boundary = buffer.lastIndexOf('\n\n');
    if (boundary === -1) continue;

    const complete = buffer.slice(0, boundary);
    buffer = buffer.slice(boundary + 2);

    const events = parseSseChunk(complete);
    for (const item of events) {
      if (item.event === 'status') {
        handlers.onStatus?.((item.data as { text?: string }).text || '');
      }

      if (item.event === 'reply_delta') {
        handlers.onReplyDelta?.((item.data as { text?: string }).text || '');
      }

      if (item.event === 'result') {
        finalResult = item.data as TResult;
        handlers.onResult?.(finalResult);
      }

      if (item.event === 'error') {
        throw new Error((item.data as { message?: string }).message || 'AI 流式请求失败。');
      }
    }
  }

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
