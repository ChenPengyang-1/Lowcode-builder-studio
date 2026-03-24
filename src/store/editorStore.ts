import { create } from 'zustand';
import type { ComponentValue, PageNode, PageSchema, SavedTemplate } from '../types/schema';
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
  dragMaterialType: string | null;
  dragNodeId: string | null;
  canUndo: boolean;
  canRedo: boolean;
  submissions: Record<string, unknown>[];
  templates: SavedTemplate[];
  activeTemplateId: string | null;
  addMaterial: (type: string) => void;
  insertMaterial: (type: string, parentId?: string | null, index?: number) => void;
  setDragMaterialType: (type: string | null) => void;
  setDragNodeId: (id: string | null) => void;
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
  saveAsTemplate: (name?: string) => void;
  createTemplateFromSchema: (schema: PageSchema, name?: string) => string;
  updateTemplateDraft: (templateId: string) => void;
  publishTemplate: (templateId: string) => void;
  importTemplateFile: (text: string) => { ok: boolean; message: string; templateId?: string };
  exportTemplateFile: (templateId: string) => { ok: boolean; message: string; files?: ExportedFileAsset[] };
  loadTemplateDraft: (templateId: string) => void;
  loadTemplatePublished: (templateId: string) => void;
  renameTemplate: (templateId: string, name: string) => void;
  deleteTemplate: (templateId: string) => void;
}

function cloneSchema(schema: PageSchema): PageSchema {
  return JSON.parse(JSON.stringify(schema));
}

// 模板记录先存到本地，方便以前端原型的方式演示草稿/发布流程。
function loadTemplates(): SavedTemplate[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(TEMPLATE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown[];
    return Array.isArray(parsed)
      ? parsed
          .map((item) => normalizeTemplateRecord(item))
          .filter((item): item is SavedTemplate => Boolean(item))
      : [];
  } catch {
    return [];
  }
}

function persistTemplates(templates: SavedTemplate[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TEMPLATE_STORAGE_KEY, JSON.stringify(templates));
}

// 默认演示 Schema 会在首次进入编辑器时生成一份完整的落地页骨架。
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
const initialTemplates = loadTemplates();

function getSnapshotStacks(history: PageSchema[], future: PageSchema[]) {
  return {
    canUndo: history.length > 0,
    canRedo: future.length > 0,
  };
}

function pushHistory(history: PageSchema[], schema: PageSchema) {
  return [...history, cloneSchema(schema)].slice(-50);
}

// 所有 Schema 变更都统一走这里，方便集中维护撤销栈和重做栈。
function applySchemaChange(
  state: EditorState,
  nextSchema: PageSchema,
  patch?: Partial<EditorState>,
): Partial<EditorState> {
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
  const next: PageNode = deepCloneNode(node);
  next.id = createId(node.type);
  next.name = `${node.name} 副本`;
  if (next.children?.length) {
    next.children = next.children.map((child) => cloneWithNewIds(child));
  }
  return next;
}

function updateTemplatesList(updater: (templates: SavedTemplate[]) => SavedTemplate[]): SavedTemplate[] {
  const next = updater(loadTemplates());
  persistTemplates(next);
  return next;
}

function buildImportedTemplateName(baseName: string, templates: SavedTemplate[]) {
  const normalizedBase = baseName.trim() || '导入模板';
  const existingNames = new Set(templates.map((item) => item.name));

  if (!existingNames.has(normalizedBase)) {
    return normalizedBase;
  }

  const firstCandidate = `${normalizedBase}（导入）`;
  if (!existingNames.has(firstCandidate)) {
    return firstCandidate;
  }

  let index = 2;
  while (existingNames.has(`${normalizedBase}（导入${index}）`)) {
    index += 1;
  }

  return `${normalizedBase}（导入${index}）`;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  schema: initialSchema,
  selectedId: null,
  mode: 'edit',
  history: [],
  future: [],
  dragMaterialType: null,
  dragNodeId: null,
  canUndo: false,
  canRedo: false,
  submissions: [],
  templates: initialTemplates,
  activeTemplateId: initialTemplates[0]?.id ?? null,

  addMaterial: (type) => {
    get().insertMaterial(type, null, get().schema.nodes.length);
  },

  // 物料既可以插入页面根节点，也可以插入某个容器内部。
  insertMaterial: (type, parentId = null, index) => {
    const material = materialRegistry.find((item) => item.type === type);
    if (!material) return;
    set((state) =>
      applySchemaChange(state, {
        ...state.schema,
        nodes: insertNode(state.schema.nodes, material.createNode(), parentId, index),
      }, { dragMaterialType: null }),
    );
  },

  setDragMaterialType: (type) => set({ dragMaterialType: type, dragNodeId: null }),
  setDragNodeId: (id) => set({ dragNodeId: id, dragMaterialType: null }),

  // 拖拽已有节点的本质是树结构迁移，而不是单纯的 DOM 排序。
  moveNodeByDrop: (sourceId, parentId = null, index) => {
    set((state) =>
      applySchemaChange(state, {
        ...state.schema,
        nodes: moveNodeTo(state.schema.nodes, sourceId, parentId, index),
      }, { dragNodeId: null, selectedId: sourceId }),
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

    const next = cloneSchema(future[0]);
    const nextFuture = future.slice(1);
    const nextHistory = [...history, cloneSchema(schema)].slice(-50);

    set({
      schema: next,
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

  // 导入前先做归一化，避免非法数据或历史版本直接把编辑器搞坏。
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

  // 保存模板时，会把当前页面 Schema 沉淀成一份可复用模板记录。
  saveAsTemplate: (name) => {
    const current = normalizeSchema(get().schema, { fallbackTitle: '未命名模板' });
    if (!current.ok) return;
    const template: SavedTemplate = {
      id: createId('tpl'),
      name: name?.trim() || `${current.schema.pageMeta.title} 模板`,
      draftSchema: cloneSchema(current.schema),
      publishedSchema: null,
      updatedAt: new Date().toISOString(),
      publishedAt: null,
    };
    const templates = updateTemplatesList((prev) => [template, ...prev]);
    set({ templates, activeTemplateId: template.id });
  },

  createTemplateFromSchema: (schema, name) => {
    const normalized = normalizeSchema(schema, { fallbackTitle: 'AI 模板' });
    if (!normalized.ok) return '';
    const template: SavedTemplate = {
      id: createId('tpl'),
      name: name?.trim() || `${normalized.schema.pageMeta.title} AI 模板`,
      draftSchema: cloneSchema(normalized.schema),
      publishedSchema: null,
      updatedAt: new Date().toISOString(),
      publishedAt: null,
    };
    const templates = updateTemplatesList((prev) => [template, ...prev]);
    set({ templates, activeTemplateId: template.id });
    return template.id;
  },

  updateTemplateDraft: (templateId) => {
    const normalized = normalizeSchema(get().schema, { fallbackTitle: '草稿模板' });
    if (!normalized.ok) return;
    const current = cloneSchema(normalized.schema);
    const templates = updateTemplatesList((prev) =>
      prev.map((item) =>
        item.id === templateId
          ? { ...item, draftSchema: current, updatedAt: new Date().toISOString() }
          : item,
      ),
    );
    set({ templates, activeTemplateId: templateId });
  },

  // 发布时会把当前工作中的 Schema 同步成对外可用的发布快照。
  publishTemplate: (templateId) => {
    const normalized = normalizeSchema(get().schema, { fallbackTitle: '发布模板' });
    if (!normalized.ok) return;
    const current = cloneSchema(normalized.schema);
    const templates = updateTemplatesList((prev) =>
      prev.map((item) =>
        item.id === templateId
          ? {
              ...item,
              draftSchema: current,
              publishedSchema: cloneSchema(current),
              updatedAt: new Date().toISOString(),
              publishedAt: new Date().toISOString(),
            }
          : item,
      ),
    );
    set({ templates, activeTemplateId: templateId });
  },

  importTemplateFile: (text) => {
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

        const nextName = buildImportedTemplateName(normalizedTemplate.name, currentTemplates);
        const nextTemplate: SavedTemplate = {
          ...normalizedTemplate,
          id: createId('tpl'),
          name: nextName,
          updatedAt: new Date().toISOString(),
          publishedAt: normalizedTemplate.publishedSchema
            ? normalizedTemplate.publishedAt ?? new Date().toISOString()
            : null,
        };

        const templates = updateTemplatesList((prev) => [nextTemplate, ...prev]);
        set({ templates, activeTemplateId: nextTemplate.id });

        return {
          ok: true,
          message:
            nextName === normalizedTemplate.name
              ? '模板文件导入成功。'
              : `模板文件导入成功，名称已调整为“${nextName}”。`,
          templateId: nextTemplate.id,
        };
      }

      const normalizedSchema = normalizeSchema(parsed, { fallbackTitle: '导入模板' });
      if (!normalizedSchema.ok) {
        return { ok: false, message: getSchemaImportMessage(normalizedSchema) };
      }

      const nextName = buildImportedTemplateName(
        `${normalizedSchema.schema.pageMeta.title} 模板`,
        currentTemplates,
      );
      const nextTemplate: SavedTemplate = {
        id: createId('tpl'),
        name: nextName,
        draftSchema: cloneSchema(normalizedSchema.schema),
        publishedSchema: null,
        updatedAt: new Date().toISOString(),
        publishedAt: null,
      };

      const templates = updateTemplatesList((prev) => [nextTemplate, ...prev]);
      set({ templates, activeTemplateId: nextTemplate.id });

      return {
        ok: true,
        message: 'Schema 文件导入成功，已创建为草稿模板。',
        templateId: nextTemplate.id,
      };
    } catch {
      return { ok: false, message: '文件解析失败，请确认上传的是合法 JSON 文件。' };
    }
  },

  exportTemplateFile: (templateId) => {
    const template = get().templates.find((item) => item.id === templateId);
    if (!template) {
      return { ok: false, message: '未找到要导出的模板。' };
    }

    return {
      ok: true,
      message: '模板 JSON 与页面 HTML 已生成。',
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

  loadTemplateDraft: (templateId) => {
    const template = get().templates.find((item) => item.id === templateId);
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

  loadTemplatePublished: (templateId) => {
    const template = get().templates.find((item) => item.id === templateId);
    if (!template?.publishedSchema) return;
    const normalized = normalizeSchema(template.publishedSchema as PageSchema, { fallbackTitle: template.name });
    if (!normalized.ok) return;
    set((state) =>
      applySchemaChange(state, cloneSchema(normalized.schema), {
        selectedId: null,
        activeTemplateId: templateId,
      }),
    );
  },

  renameTemplate: (templateId, name) => {
    const nextName = name.trim();
    if (!nextName) return;
    const templates = updateTemplatesList((prev) =>
      prev.map((item) => (item.id === templateId ? { ...item, name: nextName, updatedAt: new Date().toISOString() } : item)),
    );
    set({ templates });
  },

  deleteTemplate: (templateId) => {
    const templates = updateTemplatesList((prev) => prev.filter((item) => item.id !== templateId));
    set((state) => ({
      templates,
      activeTemplateId: state.activeTemplateId === templateId ? templates[0]?.id ?? null : state.activeTemplateId,
    }));
  },
}));

export function useSelectedNode(): PageNode | null {
  const schema = useEditorStore((state) => state.schema);
  const selectedId = useEditorStore((state) => state.selectedId);
  if (!selectedId) return null;
  return findNode(schema.nodes, selectedId);
}
