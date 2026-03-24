import type { SavedTemplate } from '../types/schema';

export const TEMPLATE_FILE_TYPE = 'lowcode-template';
export const TEMPLATE_FILE_VERSION = '1.0.0';

export interface ExportedTemplateFile {
  type: typeof TEMPLATE_FILE_TYPE;
  version: typeof TEMPLATE_FILE_VERSION;
  exportedAt: string;
  template: SavedTemplate;
}

function sanitizeFilenamePart(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 80) || 'template';
}

export function buildTemplateExportPayload(template: SavedTemplate): ExportedTemplateFile {
  return {
    type: TEMPLATE_FILE_TYPE,
    version: TEMPLATE_FILE_VERSION,
    exportedAt: new Date().toISOString(),
    template,
  };
}

export function buildTemplateExportFilename(template: SavedTemplate) {
  const safeName = sanitizeFilenamePart(template.name);
  return `${safeName}.json`;
}

export function triggerJsonDownload(filename: string, content: string) {
  triggerFileDownload(filename, content, 'application/json;charset=utf-8');
}

export function triggerFileDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
}

export function parseImportedJson(text: string): unknown {
  return JSON.parse(text) as unknown;
}
