import type { FormField, MaterialType, PageNode, PageSchema, SavedTemplate } from '../types/schema';
import { createId } from './id';

const CURRENT_SCHEMA_VERSION = '3.0.0';
const VALID_NODE_TYPES: MaterialType[] = [
  'container',
  'text',
  'button',
  'image',
  'form',
  'hero',
  'feature-list',
  'stat-grid',
];
const VALID_FIELD_TYPES: FormField['type'][] = ['text', 'tel', 'email', 'textarea', 'select'];

interface SchemaNormalizationOptions {
  fallbackTitle?: string;
}

interface NormalizeSchemaSuccess {
  ok: true;
  schema: PageSchema;
  upgraded: boolean;
  issues: string[];
}

interface NormalizeSchemaFailure {
  ok: false;
  error: string;
  issues: string[];
}

export type NormalizeSchemaResult = NormalizeSchemaSuccess | NormalizeSchemaFailure;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// style 只保留可序列化的字符串值，避免导入脏数据直接污染渲染层。

// 样式层只保留可序列化的字符串值，避免导入后出现不可控结构。
function normalizeStyle(value: unknown) {
  if (!isObject(value)) {
    return {};
  }

  return Object.entries(value).reduce<Record<string, string>>((acc, [key, styleValue]) => {
    if (typeof styleValue === 'string') {
      acc[key] = styleValue;
    }
    return acc;
  }, {});
}

// props 只接收当前 Schema 协议支持的基础值类型，复杂对象会在这里被挡掉。

// 属性层只接收当前 Schema 协议支持的值类型。
function normalizeProps(value: unknown) {
  if (!isObject(value)) {
    return {};
  }

  return Object.entries(value).reduce<PageNode['props']>((acc, [key, propValue]) => {
    if (
      typeof propValue === 'string' ||
      typeof propValue === 'number' ||
      typeof propValue === 'boolean' ||
      propValue === undefined
    ) {
      acc[key] = propValue;
      return acc;
    }

    if (Array.isArray(propValue) && propValue.every((item) => typeof item === 'string')) {
      acc[key] = propValue;
    }

    return acc;
  }, {});
}

// actions 会被收敛到当前渲染器真正支持的交互集合里。

// 行为配置会被收敛到当前渲染器真正支持的几种交互。
function normalizeActions(value: unknown): PageNode['actions'] {
  if (!Array.isArray(value)) {
    return [{ type: 'none' }];
  }

  const actions = value.reduce<NonNullable<PageNode['actions']>>((acc, action) => {
    if (!isObject(action)) {
      return acc;
    }

    const type = action.type;
    if (type !== 'none' && type !== 'alert' && type !== 'navigate') {
      return acc;
    }

    acc.push({
      type,
      payload: typeof action.payload === 'string' ? action.payload : undefined,
    });
    return acc;
  }, []);

  return actions.length ? actions : [{ type: 'none' }];
}

// 表单字段比普通节点更容易出现缺字段或脏数据，所以会单独做一轮归一化。

// 表单字段会在这里补齐默认值，保证旧模板和 AI 结果也能继续复用。
function normalizeFormField(rawField: unknown, issues: string[]): FormField | null {
  if (!isObject(rawField)) {
    issues.push('发现非法表单字段，已忽略。');
    return null;
  }

  const label = typeof rawField.label === 'string' && rawField.label.trim() ? rawField.label.trim() : '未命名字段';
  const type = VALID_FIELD_TYPES.includes(rawField.type as FormField['type'])
    ? (rawField.type as FormField['type'])
    : 'text';

  return {
    id: typeof rawField.id === 'string' && rawField.id.trim() ? rawField.id : createId('field'),
    label,
    type,
    placeholder:
      typeof rawField.placeholder === 'string' && rawField.placeholder.trim()
        ? rawField.placeholder
        : `请输入${label}`,
    required: Boolean(rawField.required),
    options:
      type === 'select' && Array.isArray(rawField.options)
        ? rawField.options.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
        : undefined,
  };
}

// 这里会把外部传进来的节点整理成当前平台认得的标准节点结构。

// 节点归一化是 Schema 治理的核心入口，外部数据进编辑器前都要过这一层。
function normalizeNode(rawNode: unknown, issues: string[]): PageNode | null {
  if (!isObject(rawNode)) {
    issues.push('发现非法节点，已忽略。');
    return null;
  }

  const type = rawNode.type as MaterialType;
  if (!VALID_NODE_TYPES.includes(type)) {
    issues.push(`发现未知节点类型“${String(rawNode.type ?? 'unknown')}”，已忽略。`);
    return null;
  }

  const props = normalizeProps(rawNode.props);
  if (type === 'form') {
    const rawFields = Array.isArray(props.fields) ? props.fields : [];
    props.fields = rawFields
      .map((field) => normalizeFormField(field, issues))
      .filter((field): field is FormField => Boolean(field));
  }

  const children = Array.isArray(rawNode.children)
    ? rawNode.children
        .map((child) => normalizeNode(child, issues))
        .filter((child): child is PageNode => Boolean(child))
    : undefined;

  return {
    id: typeof rawNode.id === 'string' && rawNode.id.trim() ? rawNode.id : createId(type),
    type,
    name: typeof rawNode.name === 'string' && rawNode.name.trim() ? rawNode.name : `${type} 节点`,
    props,
    style: normalizeStyle(rawNode.style),
    children,
    visible: typeof rawNode.visible === 'boolean' ? rawNode.visible : true,
    actions: normalizeActions(rawNode.actions),
  };
}

// 历史版本迁移放在这里做，确保旧模板仍能被最新编辑器打开。
function migrateLegacySchema(rawSchema: Record<string, unknown>, issues: string[]) {
  const schema = { ...rawSchema };
  const legacyVersion = typeof schema.version === 'string' ? schema.version : 'legacy';

  if (!isObject(schema.pageMeta)) {
    schema.pageMeta = {};
    issues.push('旧版 Schema 缺少 pageMeta，已补默认配置。');
  }

  const pageMeta = schema.pageMeta as Record<string, unknown>;
  if (typeof pageMeta.description !== 'string') {
    pageMeta.description = '由历史模板迁移得到的页面描述';
    issues.push('旧版 Schema 缺少页面描述，已自动补齐。');
  }

  if (typeof pageMeta.background !== 'string') {
    pageMeta.background = 'linear-gradient(180deg, #eef4ff 0%, #f8fbff 100%)';
    issues.push('旧版 Schema 缺少页面背景，已自动补齐。');
  }

  if (!Array.isArray(schema.nodes)) {
    schema.nodes = [];
    issues.push('旧版 Schema 缺少节点数组，已初始化为空列表。');
  }

  schema.version = CURRENT_SCHEMA_VERSION;
  if (legacyVersion !== CURRENT_SCHEMA_VERSION) {
    issues.push(`Schema 已从 ${legacyVersion} 迁移到 ${CURRENT_SCHEMA_VERSION}。`);
  }

  return schema;
}

// 所有外部进入系统的页面数据，都会先走这里的校验、补全和版本兼容。
export function normalizeSchema(rawSchema: unknown, options: SchemaNormalizationOptions = {}): NormalizeSchemaResult {
  const issues: string[] = [];

  if (!isObject(rawSchema)) {
    return {
      ok: false,
      error: 'Schema 必须是对象结构。',
      issues,
    };
  }

  // 先迁移旧结构，再归一化当前版本字段，避免旧模板直接失效。
  const migrated = migrateLegacySchema(rawSchema, issues);
  const rawPageMeta = isObject(migrated.pageMeta) ? migrated.pageMeta : {};
  const nodes = Array.isArray(migrated.nodes)
    ? migrated.nodes
        .map((node) => normalizeNode(node, issues))
        .filter((node): node is PageNode => Boolean(node))
    : [];

  const title =
    typeof rawPageMeta.title === 'string' && rawPageMeta.title.trim()
      ? rawPageMeta.title
      : options.fallbackTitle || '未命名页面';

  if (!(typeof rawPageMeta.title === 'string' && rawPageMeta.title.trim())) {
    issues.push('Schema 缺少页面标题，已使用默认标题。');
  }

  const schema: PageSchema = {
    version: CURRENT_SCHEMA_VERSION,
    pageMeta: {
      title,
      description:
        typeof rawPageMeta.description === 'string' && rawPageMeta.description.trim()
          ? rawPageMeta.description
          : '由系统自动补齐的页面描述',
      background:
        typeof rawPageMeta.background === 'string' && rawPageMeta.background.trim()
          ? rawPageMeta.background
          : 'linear-gradient(180deg, #eef4ff 0%, #f8fbff 100%)',
    },
    nodes,
  };

  return {
    ok: true,
    schema,
    upgraded: issues.some((issue) => issue.includes('迁移') || issue.includes('补')),
    issues,
  };
}

// 模板记录归一化是在 Schema 归一化外面再包一层模板资产治理。
export function normalizeTemplateRecord(rawTemplate: unknown): SavedTemplate | null {
  if (!isObject(rawTemplate)) {
    return null;
  }

  const draftResult = normalizeSchema(rawTemplate.draftSchema, { fallbackTitle: '历史草稿模板' });
  if (!draftResult.ok) {
    return null;
  }

  const publishedResult = rawTemplate.publishedSchema == null
    ? null
    : normalizeSchema(rawTemplate.publishedSchema, { fallbackTitle: '历史发布模板' });

  return {
    id: typeof rawTemplate.id === 'string' && rawTemplate.id.trim() ? rawTemplate.id : createId('tpl'),
    name: typeof rawTemplate.name === 'string' && rawTemplate.name.trim() ? rawTemplate.name : '未命名模板',
    draftSchema: draftResult.schema,
    publishedSchema: publishedResult?.ok ? publishedResult.schema : null,
    updatedAt:
      typeof rawTemplate.updatedAt === 'string' && rawTemplate.updatedAt.trim()
        ? rawTemplate.updatedAt
        : new Date().toISOString(),
    publishedAt:
      typeof rawTemplate.publishedAt === 'string' && rawTemplate.publishedAt.trim()
        ? rawTemplate.publishedAt
        : null,
    source:
      rawTemplate.source === 'manual' || rawTemplate.source === 'ai' || rawTemplate.source === 'imported'
        ? rawTemplate.source
        : undefined,
  };
}

export function getSchemaImportMessage(result: NormalizeSchemaResult) {
  if (!result.ok) {
    return result.error;
  }

  if (result.upgraded && result.issues.length) {
    return `Schema 导入成功，并完成校验/迁移：${result.issues.join(' ')}`;
  }

  return 'Schema 导入成功。';
}

export { CURRENT_SCHEMA_VERSION };
