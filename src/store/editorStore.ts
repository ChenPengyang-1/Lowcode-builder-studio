import { create } from 'zustand';
import type { ComponentValue, PageNode, PageSchema, SavedTemplate, TemplateSummary } from '../types/schema';
import { materialRegistry } from '../materials/registry';
import { createId } from '../utils/id';
import { getSchemaImportMessage, normalizeSchema, normalizeTemplateRecord } from '../utils/schemaRuntime';
import {
  buildTemplateExportFilename,
  buildTemplateExportPayload,
  parseImportedJson,
  TEMPLATE_FILE_TYPE,
} from '../utils/templateTransfer';
import { buildStandalonePageAsset, type ExportedFileAsset } from '../utils/pageExport';
import {
  bootstrapTemplates,
  createTemplateRecord,
  deleteTemplateRecord,
  fetchTemplateDetail,
  fetchTemplateSummaries,
  publishTemplateRecord,
  renameTemplateRecord,
  updateTemplateDraftRecord,
} from '../utils/templateApi';
import {
  deepCloneNode,
  deleteNode,
  duplicateNodeAtSelection,
  findNode,
  insertNode,
  moveNodeIndex,
  moveNodeTo,
  updateNode,
} from '../utils/tree';

const TEMPLATE_STORAGE_KEY = 'lowcode_builder_templates_v1';

interface EditorState {
  schema: PageSchema;
  selectedId: string | null;
  mode: 'edit' | 'preview';
  history: PageSchema[];
  future: PageSchema[];
  canUndo: boolean;
  canRedo: boolean;
  submissions: Record<string, unknown>[];
  templates: TemplateSummary[];
  activeTemplateId: string | null;
  templateDetails: Record<string, SavedTemplate>;
  templatesHydrated: boolean;
  hydrateTemplates: () => Promise<void>;
  getTemplateDetail: (templateId: string) => Promise<SavedTemplate | null>;
  addMaterial: (type: string) => void;
  insertMaterial: (type: string, parentId?: string | null, index?: number) => void;
  moveNodeByDrop: (sourceId: string, parentId?: string | null, index?: number) => void;
  selectNode: (id: string | null) => void;
  updateNodeProps: (id: string, patch: Record<string, ComponentValue>) => void;
  updateNodeStyle: (id: string, patch: Record<string, string>) => void;
  updateNodeAction: (id: string, actionType: 'none' | 'alert' | 'navigate', payload?: string) => void;
  renameNode: (id: string, name: string) => void;
  updatePageMeta: (patch: Partial<PageSchema['pageMeta']>) => void;
  duplicateSelected: () => void;
  moveSelected: (direction: 'up' | 'down') => void;
  deleteSelected: () => void;
  resetDemo: () => void;
  undo: () => void;
  redo: () => void;
  toggleMode: () => void;
  importSchema: (text: string) => { ok: boolean; message: string };
  loadSchema: (schema: PageSchema, activeTemplateId?: string | null) => void;
  exportSchema: () => string;
  submitForm: (payload: Record<string, unknown>) => void;
  saveAsTemplate: (name?: string) => Promise<void>;
  createTemplateFromSchema: (
    schema: PageSchema,
    name?: string,
    options?: {
      source?: SavedTemplate['source'];
      publish?: boolean;
    },
  ) => Promise<string>;
  updateTemplateDraft: (templateId: string) => Promise<void>;
  publishTemplate: (templateId: string) => Promise<void>;
  importTemplateFile: (text: string) => Promise<{
    ok: boolean;
    message: string;
    templateId?: string;
    template?: SavedTemplate;
  }>;
  exportTemplateFile: (templateId: string) => Promise<{
    ok: boolean;
    message: string;
    files?: ExportedFileAsset[];
  }>;
  loadTemplateDraft: (templateId: string) => Promise<void>;
  loadTemplatePublished: (templateId: string) => Promise<void>;
  renameTemplate: (templateId: string, name: string) => Promise<void>;
  deleteTemplate: (templateId: string) => Promise<void>;
}

function cloneSchema(schema: PageSchema): PageSchema {
  return JSON.parse(JSON.stringify(schema));
}

function loadLegacyTemplates(): SavedTemplate[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown[];
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((item) => normalizeTemplateRecord(item))
      .filter((item): item is SavedTemplate => Boolean(item));
  } catch {
    return [];
  }
}

function persistLegacyTemplates(templates: SavedTemplate[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

function updateLegacyTemplatesList(updater: (templates: SavedTemplate[]) => SavedTemplate[]) {
  const nextTemplates = updater(loadLegacyTemplates());
  persistLegacyTemplates(nextTemplates);
  return nextTemplates;
}

function countNodes(nodes: PageNode[]): number {
  return nodes.reduce((total, node) => total + 1 + countNodes(node.children ?? []), 0);
}

function toTemplateSummary(template: SavedTemplate): TemplateSummary {
  return {
    id: template.id,
    name: template.name,
    updatedAt: template.updatedAt,
    publishedAt: template.publishedAt ?? null,
    source: template.source,
    hasPublished: Boolean(template.publishedSchema),
    draftNodeCount: countNodes(template.draftSchema.nodes),
    publishedNodeCount: template.publishedSchema ? countNodes(template.publishedSchema.nodes) : 0,
    thumbnailUrl: null,
  };
}

function sortTemplateSummaries(templates: TemplateSummary[]) {
  return [...templates].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function mergeTemplateSummary(templates: TemplateSummary[], summary: TemplateSummary) {
  const nextTemplates = templates.filter((item) => item.id !== summary.id);
  return sortTemplateSummaries([summary, ...nextTemplates]);
}

function buildDetailsMap(templates: SavedTemplate[]) {
  return templates.reduce<Record<string, SavedTemplate>>((result, template) => {
    result[template.id] = template;
    return result;
  }, {});
}

// 默认演示 Schema 会在第一次进入编辑器时生成一版完整页面骨架，
// 让物料区、图层树和属性面板都能立刻进入可操作状态。
function makeDemoSchema(): PageSchema {
  return {
    version: '3.0.0',
    pageMeta: {
      title: '春季拉新活动页',
      description: '配置驱动式营销页面搭建平台演示，支持模板中心、草稿/发布、节点拖拽重排与动态表单。',
      background: 'linear-gradient(180deg, #eef4ff 0%, #f8fbff 100%)',
    },
    nodes: [
      materialRegistry.find((item) => item.type === 'hero')!.createNode(),
      materialRegistry.find((item) => item.type === 'stat-grid')!.createNode(),
      materialRegistry.find((item) => item.type === 'feature-list')!.createNode(),
      materialRegistry.find((item) => item.type === 'form')!.createNode(),
    ],
  };
}

const initialSchema = makeDemoSchema();

function getSnapshotStacks(history: PageSchema[], future: PageSchema[]) {
  return {
    canUndo: history.length > 0,
    canRedo: future.length > 0,
  };
}

function pushHistory(history: PageSchema[], schema: PageSchema) {
  return [...history, cloneSchema(schema)].slice(-50);
}

function applySchemaChange(
  state: EditorState,
  nextSchema: PageSchema,
  patch?: Partial<EditorState>,
): Partial<EditorState> {
  // 所有会改动页面结构的操作都统一走这里，避免各个 action 分散维护 undo / redo。
  const history = pushHistory(state.history, state.schema);
  const future: PageSchema[] = [];

  return {
    schema: nextSchema,
    history,
    future,
    ...getSnapshotStacks(history, future),
    ...patch,
  };
}

function cloneWithNewIds(node: PageNode): PageNode {
  const nextNode = deepCloneNode(node);
  nextNode.id = createId(node.type);
  nextNode.name = `${node.name} 副本`;

  if (nextNode.children?.length) {
    nextNode.children = nextNode.children.map((child) => cloneWithNewIds(child));
  }

  return nextNode;
}

function buildImportedTemplateName(baseName: string, templates: TemplateSummary[]) {
  const normalizedBase = baseName.trim() || '导入模板';
  const existingNames = new Set(templates.map((item) => item.name));

  if (!existingNames.has(normalizedBase)) {
    return normalizedBase;
  }

  const firstCandidate = `${normalizedBase}(导入)`;
  if (!existingNames.has(firstCandidate)) {
    return firstCandidate;
  }

  let index = 2;
  while (existingNames.has(`${normalizedBase}（导入 ${index}）`)) {
    index += 1;
  }

  return `${normalizedBase}（导入 ${index}）`;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  schema: initialSchema,
  selectedId: null,
  mode: 'edit',
  history: [],
  future: [],
  canUndo: false,
  canRedo: false,
  submissions: [],
  templates: [],
  activeTemplateId: null,
  templateDetails: {},
  templatesHydrated: false,

  hydrateTemplates: async () => {
    if (get().templatesHydrated) return;

    const legacyTemplates = loadLegacyTemplates();

    try {
      // 列表页先拿模板摘要；旧 localStorage 模板只在首次迁移和离线兜底时参与。
      let summaries = await fetchTemplateSummaries();
      if (!summaries.length && legacyTemplates.length) {
        summaries = await bootstrapTemplates(legacyTemplates);
      }

      const currentActive = get().activeTemplateId;
      const nextActive = summaries.find((item) => item.id === currentActive)?.id ?? summaries[0]?.id ?? null;

      set({
        templates: sortTemplateSummaries(summaries),
        activeTemplateId: nextActive,
        templateDetails: legacyTemplates.length ? buildDetailsMap(legacyTemplates) : {},
        templatesHydrated: true,
      });
    } catch {
      const fallbackSummaries = sortTemplateSummaries(legacyTemplates.map((item) => toTemplateSummary(item)));
      const currentActive = get().activeTemplateId;
      const nextActive =
        fallbackSummaries.find((item) => item.id === currentActive)?.id ?? fallbackSummaries[0]?.id ?? null;

      set({
        templates: fallbackSummaries,
        activeTemplateId: nextActive,
        templateDetails: buildDetailsMap(legacyTemplates),
        templatesHydrated: true,
      });
    }
  },

  getTemplateDetail: async (templateId) => {
    const cached = get().templateDetails[templateId];
    if (cached) {
      return cached;
    }

    try {
      // 完整 schema 只在真正进入模板时按需拉取，避免列表页长期挂着所有详情。
      const template = await fetchTemplateDetail(templateId);
      if (!template) return null;

      set((state) => ({
        templateDetails: {
          ...state.templateDetails,
          [templateId]: template,
        },
        templates: mergeTemplateSummary(state.templates, toTemplateSummary(template)),
      }));

      return template;
    } catch {
      const localTemplate = loadLegacyTemplates().find((item) => item.id === templateId) ?? null;
      if (!localTemplate) return null;

      set((state) => ({
        templateDetails: {
          ...state.templateDetails,
          [templateId]: localTemplate,
        },
        templates: mergeTemplateSummary(state.templates, toTemplateSummary(localTemplate)),
      }));

      return localTemplate;
    }
  },

  addMaterial: (type) => {
    get().insertMaterial(type, null, get().schema.nodes.length);
  },

  insertMaterial: (type, parentId = null, index) => {
    const material = materialRegistry.find((item) => item.type === type);
    if (!material) return;

    set((state) =>
      applySchemaChange(state, {
        ...state.schema,
        nodes: insertNode(state.schema.nodes, material.createNode(), parentId, index),
      }),
    );
  },

  moveNodeByDrop: (sourceId, parentId = null, index) => {
    set((state) =>
      applySchemaChange(
        state,
        {
          ...state.schema,
          nodes: moveNodeTo(state.schema.nodes, sourceId, parentId, index),
        },
        { selectedId: sourceId },
      ),
    );
  },

  selectNode: (id) => set({ selectedId: id }),

  updateNodeProps: (id, patch) => {
    set((state) =>
      applySchemaChange(state, {
        ...state.schema,
        nodes: updateNode(state.schema.nodes, id, (node) => ({
          ...node,
          props: { ...node.props, ...patch },
        })),
      }),
    );
  },

  updateNodeStyle: (id, patch) => {
    set((state) =>
      applySchemaChange(state, {
        ...state.schema,
        nodes: updateNode(state.schema.nodes, id, (node) => ({
          ...node,
          style: { ...node.style, ...patch },
        })),
      }),
    );
  },

  updateNodeAction: (id, actionType, payload) => {
    set((state) =>
      applySchemaChange(state, {
        ...state.schema,
        nodes: updateNode(state.schema.nodes, id, (node) => ({
          ...node,
          actions: [{ type: actionType, payload }],
        })),
      }),
    );
  },

  renameNode: (id, name) => {
    set((state) =>
      applySchemaChange(state, {
        ...state.schema,
        nodes: updateNode(state.schema.nodes, id, (node) => ({
          ...node,
          name,
        })),
      }),
    );
  },

  updatePageMeta: (patch) => {
    set((state) =>
      applySchemaChange(state, {
        ...state.schema,
        pageMeta: {
          ...state.schema.pageMeta,
          ...patch,
        },
      }),
    );
  },

  duplicateSelected: () => {
    const { selectedId } = get();
    if (!selectedId) return;

    set((state) => {
      const target = findNode(state.schema.nodes, selectedId);
      if (!target) return {};

      return applySchemaChange(
        state,
        {
          ...state.schema,
          nodes: duplicateNodeAtSelection(state.schema.nodes, selectedId, cloneWithNewIds(target)),
        },
        { selectedId: null },
      );
    });
  },

  moveSelected: (direction) => {
    const { selectedId } = get();
    if (!selectedId) return;

    set((state) =>
      applySchemaChange(state, {
        ...state.schema,
        nodes: moveNodeIndex(state.schema.nodes, selectedId, direction),
      }),
    );
  },

  deleteSelected: () => {
    const { selectedId } = get();
    if (!selectedId) return;

    set((state) =>
      applySchemaChange(
        state,
        {
          ...state.schema,
          nodes: deleteNode(state.schema.nodes, selectedId),
        },
        { selectedId: null },
      ),
    );
  },

  resetDemo: () => {
    set((state) =>
      applySchemaChange(state, makeDemoSchema(), {
        selectedId: null,
        submissions: [],
        activeTemplateId: null,
      }),
    );
  },

  undo: () => {
    const { history, schema, future } = get();
    if (!history.length) return;

    const previous = cloneSchema(history[history.length - 1]);
    const nextHistory = history.slice(0, -1);
    const nextFuture = [cloneSchema(schema), ...future].slice(0, 50);

    set({
      schema: previous,
      history: nextHistory,
      future: nextFuture,
      selectedId: null,
      ...getSnapshotStacks(nextHistory, nextFuture),
    });
  },

  redo: () => {
    const { history, schema, future } = get();
    if (!future.length) return;

    const nextSchema = cloneSchema(future[0]);
    const nextFuture = future.slice(1);
    const nextHistory = [...history, cloneSchema(schema)].slice(-50);

    set({
      schema: nextSchema,
      history: nextHistory,
      future: nextFuture,
      selectedId: null,
      ...getSnapshotStacks(nextHistory, nextFuture),
    });
  },

  toggleMode: () =>
    set((state) => ({
      mode: state.mode === 'edit' ? 'preview' : 'edit',
    })),

  importSchema: (text) => {
    try {
      const parsed = JSON.parse(text) as unknown;
      const normalized = normalizeSchema(parsed);

      if (!normalized.ok) {
        return { ok: false, message: getSchemaImportMessage(normalized) };
      }

      set((state) =>
        applySchemaChange(state, cloneSchema(normalized.schema), {
          selectedId: null,
        }),
      );

      return { ok: true, message: getSchemaImportMessage(normalized) };
    } catch {
      return { ok: false, message: 'JSON 解析失败，请检查格式。' };
    }
  },

  loadSchema: (schema, activeTemplateId = null) => {
    const normalized = normalizeSchema(schema, { fallbackTitle: schema.pageMeta?.title });
    if (!normalized.ok) return;

    set((state) =>
      applySchemaChange(state, cloneSchema(normalized.schema), {
        selectedId: null,
        activeTemplateId,
      }),
    );
  },

  exportSchema: () => JSON.stringify(get().schema, null, 2),

  submitForm: (payload) =>
    set((state) => ({
      submissions: [payload, ...state.submissions].slice(0, 10),
    })),

  saveAsTemplate: async (name) => {
    const current = normalizeSchema(get().schema, { fallbackTitle: '未命名模板' });
    if (!current.ok) return;

    const activeTemplate = get().templates.find((item) => item.id === get().activeTemplateId) ?? null;
    const now = new Date().toISOString();
    const template: SavedTemplate = {
      id: createId('tpl'),
      name: name?.trim() || `${current.schema.pageMeta.title} 模板`,
      draftSchema: cloneSchema(current.schema),
      publishedSchema: null,
      updatedAt: now,
      publishedAt: null,
      source: activeTemplate?.source ?? 'manual',
    };

    try {
      const saved = await createTemplateRecord(template);
      if (!saved) return;

      set((state) => ({
        templates: mergeTemplateSummary(state.templates, toTemplateSummary(saved)),
        activeTemplateId: saved.id,
        templateDetails: {
          ...state.templateDetails,
          [saved.id]: saved,
        },
      }));
    } catch {
      const templates = updateLegacyTemplatesList((prev) => [template, ...prev]);
      set({
        templates: sortTemplateSummaries(templates.map((item) => toTemplateSummary(item))),
        activeTemplateId: template.id,
        templateDetails: buildDetailsMap(templates),
      });
    }
  },

  createTemplateFromSchema: async (schema, name, options) => {
    const normalized = normalizeSchema(schema, { fallbackTitle: 'AI 模板' });
    if (!normalized.ok) return '';

    const now = new Date().toISOString();
    const shouldPublish = Boolean(options?.publish);
    const template: SavedTemplate = {
      id: createId('tpl'),
      name: name?.trim() || `${normalized.schema.pageMeta.title} AI 模板`,
      draftSchema: cloneSchema(normalized.schema),
      publishedSchema: shouldPublish ? cloneSchema(normalized.schema) : null,
      updatedAt: now,
      publishedAt: shouldPublish ? now : null,
      source: options?.source ?? 'ai',
    };

    try {
      const saved = await createTemplateRecord(template);
      if (!saved) return '';

      set((state) => ({
        templates: mergeTemplateSummary(state.templates, toTemplateSummary(saved)),
        activeTemplateId: saved.id,
        templateDetails: {
          ...state.templateDetails,
          [saved.id]: saved,
        },
      }));

      return saved.id;
    } catch {
      const templates = updateLegacyTemplatesList((prev) => [template, ...prev]);
      set({
        templates: sortTemplateSummaries(templates.map((item) => toTemplateSummary(item))),
        activeTemplateId: template.id,
        templateDetails: buildDetailsMap(templates),
      });
      return template.id;
    }
  },

  updateTemplateDraft: async (templateId) => {
    const normalized = normalizeSchema(get().schema, { fallbackTitle: '草稿模板' });
    if (!normalized.ok) return;

    const currentSchema = cloneSchema(normalized.schema);

    try {
      const updated = await updateTemplateDraftRecord(templateId, currentSchema);
      if (!updated) return;

      set((state) => ({
        templates: mergeTemplateSummary(state.templates, toTemplateSummary(updated)),
        activeTemplateId: templateId,
        templateDetails: {
          ...state.templateDetails,
          [templateId]: updated,
        },
      }));
    } catch {
      const templates = updateLegacyTemplatesList((prev) =>
        prev.map((item) =>
          item.id === templateId
            ? {
                ...item,
                draftSchema: currentSchema,
                updatedAt: new Date().toISOString(),
                source: item.source ?? 'manual',
              }
            : item,
        ),
      );

      set({
        templates: sortTemplateSummaries(templates.map((item) => toTemplateSummary(item))),
        activeTemplateId: templateId,
        templateDetails: buildDetailsMap(templates),
      });
    }
  },

  publishTemplate: async (templateId) => {
    const normalized = normalizeSchema(get().schema, { fallbackTitle: '发布模板' });
    if (!normalized.ok) return;

    const currentSchema = cloneSchema(normalized.schema);

    try {
      const updated = await publishTemplateRecord(templateId, currentSchema);
      if (!updated) return;

      set((state) => ({
        templates: mergeTemplateSummary(state.templates, toTemplateSummary(updated)),
        activeTemplateId: templateId,
        templateDetails: {
          ...state.templateDetails,
          [templateId]: updated,
        },
      }));
    } catch {
      const templates = updateLegacyTemplatesList((prev) =>
        prev.map((item) =>
          item.id === templateId
            ? {
                ...item,
                draftSchema: currentSchema,
                publishedSchema: cloneSchema(currentSchema),
                updatedAt: new Date().toISOString(),
                publishedAt: new Date().toISOString(),
                source: item.source ?? 'manual',
              }
            : item,
        ),
      );

      set({
        templates: sortTemplateSummaries(templates.map((item) => toTemplateSummary(item))),
        activeTemplateId: templateId,
        templateDetails: buildDetailsMap(templates),
      });
    }
  },

  importTemplateFile: async (text) => {
    try {
      const parsed = parseImportedJson(text);
      const currentTemplates = get().templates;

      if (
        typeof parsed === 'object' &&
        parsed !== null &&
        'type' in parsed &&
        (parsed as { type?: unknown }).type === TEMPLATE_FILE_TYPE &&
        'template' in parsed
      ) {
        const normalizedTemplate = normalizeTemplateRecord((parsed as { template?: unknown }).template);
        if (!normalizedTemplate) {
          return { ok: false, message: '模板文件结构不合法，无法导入。' };
        }

        const nextTemplate: SavedTemplate = {
          ...normalizedTemplate,
          id: createId('tpl'),
          name: buildImportedTemplateName(normalizedTemplate.name, currentTemplates),
          updatedAt: new Date().toISOString(),
          publishedAt: normalizedTemplate.publishedSchema
            ? normalizedTemplate.publishedAt ?? new Date().toISOString()
            : null,
          source: 'imported',
        };

        try {
          const saved = await createTemplateRecord(nextTemplate);
          if (!saved) {
            return { ok: false, message: '模板文件导入失败。' };
          }

          set((state) => ({
            templates: mergeTemplateSummary(state.templates, toTemplateSummary(saved)),
            activeTemplateId: saved.id,
            templateDetails: {
              ...state.templateDetails,
              [saved.id]: saved,
            },
          }));

          return {
            ok: true,
            message: '模板文件导入成功。',
            templateId: saved.id,
            template: saved,
          };
        } catch {
          const templates = updateLegacyTemplatesList((prev) => [nextTemplate, ...prev]);
          set({
            templates: sortTemplateSummaries(templates.map((item) => toTemplateSummary(item))),
            activeTemplateId: nextTemplate.id,
            templateDetails: buildDetailsMap(templates),
          });

          return {
            ok: true,
            message: '模板文件导入成功。',
            templateId: nextTemplate.id,
            template: nextTemplate,
          };
        }
      }

      const normalizedSchema = normalizeSchema(parsed, { fallbackTitle: '导入模板' });
      if (!normalizedSchema.ok) {
        return { ok: false, message: getSchemaImportMessage(normalizedSchema) };
      }

      const nextTemplate: SavedTemplate = {
        id: createId('tpl'),
        name: buildImportedTemplateName(`${normalizedSchema.schema.pageMeta.title} 模板`, currentTemplates),
        draftSchema: cloneSchema(normalizedSchema.schema),
        publishedSchema: null,
        updatedAt: new Date().toISOString(),
        publishedAt: null,
        source: 'imported',
      };

      try {
        const saved = await createTemplateRecord(nextTemplate);
        if (!saved) {
          return { ok: false, message: 'Schema 文件导入失败。' };
        }

        set((state) => ({
          templates: mergeTemplateSummary(state.templates, toTemplateSummary(saved)),
          activeTemplateId: saved.id,
          templateDetails: {
            ...state.templateDetails,
            [saved.id]: saved,
          },
        }));

        return {
          ok: true,
          message: 'Schema 文件导入成功，已创建为草稿模板。',
          templateId: saved.id,
          template: saved,
        };
      } catch {
        const templates = updateLegacyTemplatesList((prev) => [nextTemplate, ...prev]);
        set({
          templates: sortTemplateSummaries(templates.map((item) => toTemplateSummary(item))),
          activeTemplateId: nextTemplate.id,
          templateDetails: buildDetailsMap(templates),
        });

        return {
          ok: true,
          message: 'Schema 文件导入成功，已创建为草稿模板。',
          templateId: nextTemplate.id,
          template: nextTemplate,
        };
      }
    } catch {
      return { ok: false, message: '文件解析失败，请确认上传的是合法 JSON 文件。' };
    }
  },

  exportTemplateFile: async (templateId) => {
    const template = await get().getTemplateDetail(templateId);
    if (!template) {
      return { ok: false, message: '未找到要导出的模板。' };
    }

    return {
      ok: true,
      message: '模板 JSON 和页面 HTML 已生成。',
      files: [
        {
          filename: buildTemplateExportFilename(template),
          content: JSON.stringify(buildTemplateExportPayload(template), null, 2),
          mimeType: 'application/json;charset=utf-8',
        },
        buildStandalonePageAsset(template),
      ],
    };
  },

  loadTemplateDraft: async (templateId) => {
    const template = await get().getTemplateDetail(templateId);
    if (!template) return;

    const normalized = normalizeSchema(template.draftSchema, { fallbackTitle: template.name });
    if (!normalized.ok) return;

    set((state) =>
      applySchemaChange(state, cloneSchema(normalized.schema), {
        selectedId: null,
        activeTemplateId: templateId,
      }),
    );
  },

  loadTemplatePublished: async (templateId) => {
    const template = await get().getTemplateDetail(templateId);
    if (!template?.publishedSchema) return;

    const normalized = normalizeSchema(template.publishedSchema, { fallbackTitle: template.name });
    if (!normalized.ok) return;

    set((state) =>
      applySchemaChange(state, cloneSchema(normalized.schema), {
        selectedId: null,
        activeTemplateId: templateId,
      }),
    );
  },

  renameTemplate: async (templateId, name) => {
    const nextName = name.trim();
    if (!nextName) return;

    try {
      const updatedSummary = await renameTemplateRecord(templateId, nextName);
      if (!updatedSummary) return;

      set((state) => ({
        templates: mergeTemplateSummary(state.templates, updatedSummary),
        templateDetails: state.templateDetails[templateId]
          ? {
              ...state.templateDetails,
              [templateId]: {
                ...state.templateDetails[templateId],
                name: nextName,
                updatedAt: updatedSummary.updatedAt,
              },
            }
          : state.templateDetails,
      }));
    } catch {
      const templates = updateLegacyTemplatesList((prev) =>
        prev.map((item) =>
          item.id === templateId ? { ...item, name: nextName, updatedAt: new Date().toISOString() } : item,
        ),
      );

      set({
        templates: sortTemplateSummaries(templates.map((item) => toTemplateSummary(item))),
        templateDetails: buildDetailsMap(templates),
      });
    }
  },

  deleteTemplate: async (templateId) => {
    try {
      await deleteTemplateRecord(templateId);
      set((state) => {
        const nextTemplates = state.templates.filter((item) => item.id !== templateId);
        const nextDetails = { ...state.templateDetails };
        delete nextDetails[templateId];

        return {
          templates: nextTemplates,
          templateDetails: nextDetails,
          activeTemplateId:
            state.activeTemplateId === templateId ? nextTemplates[0]?.id ?? null : state.activeTemplateId,
        };
      });
    } catch {
      const templates = updateLegacyTemplatesList((prev) => prev.filter((item) => item.id !== templateId));
      set((state) => ({
        templates: sortTemplateSummaries(templates.map((item) => toTemplateSummary(item))),
        templateDetails: buildDetailsMap(templates),
        activeTemplateId:
          state.activeTemplateId === templateId ? templates[0]?.id ?? null : state.activeTemplateId,
      }));
    }
  },
}));

export function useSelectedNode(): PageNode | null {
  const schema = useEditorStore((state) => state.schema);
  const selectedId = useEditorStore((state) => state.selectedId);
  if (!selectedId) return null;
  return findNode(schema.nodes, selectedId);
}
