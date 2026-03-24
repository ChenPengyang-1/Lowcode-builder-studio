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

export function generateTemplateByAI(payload: GeneratePayload) {
  return postJson<GeneratePayload, AiTemplateApiResult>('/api/ai/template/generate', payload);
}

export function chatTemplateByAI(payload: ChatPayload) {
  return postJson<ChatPayload, AiChatApiResult>('/api/ai/template/chat', payload);
}

export function refineTemplateByAI(payload: RefinePayload) {
  return postJson<RefinePayload, AiTemplateApiResult>('/api/ai/template/refine', payload);
}
