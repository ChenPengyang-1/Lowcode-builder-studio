import type { PageSchema, SavedTemplate, TemplateSummary } from '../types/schema';
import { normalizeTemplateRecord } from './schemaRuntime';

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTemplateSummary(raw: unknown): TemplateSummary | null {
  if (!isObjectRecord(raw)) {
    return null;
  }

  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id : null;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name : null;
  const updatedAt = typeof raw.updatedAt === 'string' && raw.updatedAt.trim() ? raw.updatedAt : null;

  if (!id || !name || !updatedAt) {
    return null;
  }

  return {
    id,
    name,
    updatedAt,
    publishedAt:
      typeof raw.publishedAt === 'string' && raw.publishedAt.trim() ? raw.publishedAt : null,
    source:
      raw.source === 'manual' || raw.source === 'ai' || raw.source === 'imported'
        ? raw.source
        : undefined,
    hasPublished: Boolean(raw.hasPublished),
    draftNodeCount: typeof raw.draftNodeCount === 'number' ? raw.draftNodeCount : 0,
    publishedNodeCount: typeof raw.publishedNodeCount === 'number' ? raw.publishedNodeCount : 0,
    thumbnailUrl:
      typeof raw.thumbnailUrl === 'string' && raw.thumbnailUrl.trim() ? raw.thumbnailUrl : null,
  };
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T;
  return data;
}

async function ensureOk<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = '模板接口请求失败。';
    try {
      const error = (await response.json()) as { message?: string };
      if (typeof error.message === 'string' && error.message.trim()) {
        message = error.message;
      }
    } catch {
      // ignore parse failure
    }
    throw new Error(message);
  }

  return readJson<T>(response);
}

export async function fetchTemplateSummaries() {
  const response = await fetch('/api/templates');
  const data = await ensureOk<{ templates?: unknown[] }>(response);
  return Array.isArray(data.templates)
    ? data.templates
        .map((item) => normalizeTemplateSummary(item))
        .filter((item): item is TemplateSummary => Boolean(item))
    : [];
}

export async function fetchTemplateDetail(templateId: string) {
  const response = await fetch(`/api/templates/${templateId}`);
  const data = await ensureOk<{ template?: unknown }>(response);
  return data.template ? normalizeTemplateRecord(data.template) : null;
}

export async function bootstrapTemplates(templates: SavedTemplate[]) {
  const response = await fetch('/api/templates/bootstrap', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ templates }),
  });
  const data = await ensureOk<{ templates?: unknown[] }>(response);
  return Array.isArray(data.templates)
    ? data.templates
        .map((item) => normalizeTemplateSummary(item))
        .filter((item): item is TemplateSummary => Boolean(item))
    : [];
}

interface CreateTemplatePayload {
  id: string;
  name: string;
  draftSchema: PageSchema;
  publishedSchema?: PageSchema | null;
  source?: SavedTemplate['source'];
  updatedAt?: string;
  publishedAt?: string | null;
  thumbnailUrl?: string | null;
}

export async function createTemplateRecord(payload: CreateTemplatePayload) {
  const response = await fetch('/api/templates', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await ensureOk<{ template?: unknown }>(response);
  return data.template ? normalizeTemplateRecord(data.template) : null;
}

export async function updateTemplateDraftRecord(templateId: string, schema: PageSchema) {
  const response = await fetch(`/api/templates/${templateId}/draft`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ schema }),
  });
  const data = await ensureOk<{ template?: unknown }>(response);
  return data.template ? normalizeTemplateRecord(data.template) : null;
}

export async function publishTemplateRecord(templateId: string, schema: PageSchema) {
  const response = await fetch(`/api/templates/${templateId}/publish`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ schema }),
  });
  const data = await ensureOk<{ template?: unknown }>(response);
  return data.template ? normalizeTemplateRecord(data.template) : null;
}

export async function renameTemplateRecord(templateId: string, name: string) {
  const response = await fetch(`/api/templates/${templateId}/name`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name }),
  });
  const data = await ensureOk<{ template?: unknown }>(response);
  return data.template ? normalizeTemplateSummary(data.template) : null;
}

export async function deleteTemplateRecord(templateId: string) {
  const response = await fetch(`/api/templates/${templateId}`, {
    method: 'DELETE',
  });
  await ensureOk<{ ok: boolean }>(response);
}
