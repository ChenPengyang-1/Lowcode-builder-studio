import { useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import type { MutableRefObject } from 'react';
import { SchemaPreview } from '../components/SchemaPreview';
import { useEditorStore } from '../store/editorStore';
import type { SavedTemplate, TemplateSummary } from '../types/schema';
import type { AuthSession } from '../utils/auth';
import {
  generateTemplateFromPrompt,
  refineTemplateFromPrompt,
  summarizeSchema,
  type AiTemplateResult,
} from '../utils/aiStudio';
import {
  chatTemplateByAIStream,
  generateTemplateByAIStream,
  refineTemplateByAIStream,
} from '../utils/aiApi';
import { parseImportedJson, TEMPLATE_FILE_TYPE, triggerFileDownload } from '../utils/templateTransfer';

interface ChatMessage {
  id: string;
  role: 'assistant' | 'user';
  text: string;
}

type TemplateSort = 'updated' | 'published' | 'name';
type TemplateSourceFilter = 'all' | 'manual' | 'ai' | 'imported';

type AssistantMode = 'generate' | 'refine';
type AssistantCapability = 'checking' | 'ai' | 'fallback';
type GenerateStep = 'scene' | 'audience' | 'modules' | 'style' | 'done';

interface GenerateIntent {
  scene: string;
  audience: string;
  modules: string;
  style: string;
  extraNotes: string[];
}

const generateReplies: Record<GenerateStep, string[]> = {
  scene: ['课程报名页', '产品介绍页', '招聘专题页', '活动落地页'],
  audience: ['面向企业客户', '面向校招用户', '面向课程报名用户', '面向普通访客'],
  modules: [
    '主视觉、亮点区、数据区、表单',
    '主视觉、图片区、亮点区、表单',
    '主视觉、FAQ、案例区、表单',
    '尽量简洁一些',
  ],
  style: ['极简留白', '偏科技蓝', '更偏企业感', '表单信息更详细一些'],
  done: ['再多加一张图片', '再加一个表单', '把表单字段补充详细一点', '增加 FAQ'],
};

const refineReplies = ['表单字段再丰富一点', '再加一个表单', '多一张描述图片', '整体更简洁一些'];

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function buildGeneratePrompt(intent: GenerateIntent) {
  const extraNotes = intent.extraNotes.length ? `，另外补充要求：${intent.extraNotes.join('，')}` : '';
  return `请生成一个${intent.scene}，目标用户是${intent.audience}，页面需要包含${intent.modules}，整体风格希望是${intent.style}${extraNotes}`;
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === 'AbortError'
    : error instanceof Error && error.name === 'AbortError';
}

function getTemplateSourceLabel(source: 'manual' | 'ai' | 'imported' | undefined) {
  if (source === 'ai') return 'AI 生成';
  if (source === 'imported') return '导入模板';
  return '手工搭建';
}

function getAssistantCapabilityLabel(capability: AssistantCapability) {
  if (capability === 'ai') return 'AI 模式';
  if (capability === 'fallback') return '引导模式';
  return '检测中';
}

function filterAndSortTemplates(
  templates: TemplateSummary[],
  keyword: string,
  sourceFilter: TemplateSourceFilter,
  sortBy: TemplateSort,
) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  return [...templates]
    .filter((template) =>
      normalizedKeyword ? template.name.toLowerCase().includes(normalizedKeyword) : true,
    )
    .filter((template) =>
      sourceFilter === 'all' ? true : (template.source ?? 'manual') === sourceFilter,
    )
    .sort((left, right) => {
      if (sortBy === 'name') {
        return left.name.localeCompare(right.name, 'zh-CN');
      }

      if (sortBy === 'updated') {
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      }

      return new Date(right.publishedAt ?? 0).getTime() - new Date(left.publishedAt ?? 0).getTime();
    });
}

function buildActionPrompt(messages: ChatMessage[], latestUserText: string, action: 'generate' | 'refine') {
  // 这里会把最近几轮对话重新整理成一段更完整的任务指令，后续生成/修改都基于它继续。
  const recentTranscript = [...messages, { id: 'latest', role: 'user' as const, text: latestUserText }]
    .slice(-8)
    .map((message) => `${message.role === 'user' ? '用户' : '助手'}：${message.text}`)
    .join('\n');

  return [
    '请基于下面这段最近对话整理需求，并执行当前动作。',
    `当前动作：${action === 'generate' ? '生成新的页面模板' : '在当前结果基础上继续修改页面模板'}`,
    '最近对话：',
    recentTranscript,
    '请综合以上上下文，不要只盯着最后一句话。',
  ].join('\n');
}

function getAssistantHelperText(options: {
  assistantCapability: AssistantCapability;
  assistantMode: AssistantMode;
  selectedTemplateName: string | null;
  hasPreviewSchema: boolean;
}) {
  const { assistantCapability, assistantMode, selectedTemplateName, hasPreviewSchema } = options;

  if (assistantCapability === 'ai') {
    if (assistantMode === 'refine') {
      return selectedTemplateName
        ? `当前为 AI 模式，我们会像聊天一样围绕“${selectedTemplateName}”继续确认和调整。只有你明确说“按这个改”或直接提出具体改动时，我才会真正更新模板。`
        : '当前为 AI 模式，先在左侧选择一份模板，我会直接继续修改。';
    }

    return hasPreviewSchema
      ? '当前为 AI 模式，已经有一版结果了。你可以继续像聊天一样讨论方向；想让我真正改动时，直接说“按这个改”或给出明确修改要求即可。'
      : '当前为 AI 模式。你可以先像和 GPT 一样确认目标、模块和风格；只有你明确说“开始生成”时，我才会真正开始构建页面。';
  }

  if (assistantMode === 'refine') {
    return selectedTemplateName
      ? `当前为引导模式，正在围绕“${selectedTemplateName}”继续调整。`
      : '当前为引导模式，先在左侧选一份模板，我会围绕它继续修改。';
  }

  return '当前为引导模式。我会先收集页面类型、目标用户、页面模块和整体风格，再生成一版初稿。';
}

function getPromptPlaceholder(options: {
  assistantMode: AssistantMode;
  assistantCapability: AssistantCapability;
  generateStep: GenerateStep;
  hasPreviewSchema: boolean;
}) {
  const { assistantMode, assistantCapability, generateStep, hasPreviewSchema } = options;
  const isAiMode = assistantCapability === 'ai';

  if (assistantMode === 'refine') {
    return isAiMode
      ? '先像聊天一样说出你的想法，比如“这个首屏有点正式，能再活一点吗”；想让我真正动手时，就直接说“按这个改”'
      : '继续描述你想怎么改这份模板，比如“表单增加公司规模和预算范围”';
  }

  if (isAiMode) {
    return hasPreviewSchema
      ? '继续像聊天一样讨论或提出修改要求，比如“把首屏做得更有科技感”，确认后再说“按这个改”'
      : '先像聊天一样描述目标，比如“我想做一个面向企业客户的活动落地页”，确认后再说“开始生成”';
  }

  if (generateStep === 'scene') return '先告诉我你想生成什么页面';
  if (generateStep === 'audience') return '告诉我这个页面主要面向谁';
  if (generateStep === 'modules') return '告诉我页面里最需要哪些模块';
  if (generateStep === 'style') return '再补充一下整体风格或表单要求';
  return '继续补充更多要求，我会沿着当前结果继续调整';
}

function getSubmitButtonText(options: {
  assistantBusy: boolean;
  assistantCapability: AssistantCapability;
  assistantMode: AssistantMode;
  generateStep: GenerateStep;
  hasPreviewSchema: boolean;
}) {
  const { assistantBusy, assistantCapability, assistantMode, generateStep, hasPreviewSchema } = options;

  if (assistantBusy) return 'AI 处理中...';
  if (assistantCapability === 'ai') {
    return hasPreviewSchema ? '发送对话/修改' : '发送对话';
  }
  if (assistantMode === 'refine') return '发送修改要求';
  return generateStep === 'done' ? '补充并重新生成' : '发送回答';
}

function shouldFallbackToGenerate(text: string) {
  return /开始生成|直接生成|帮我生成|生成一个|做一个|创建一个|搭一个|来一版/u.test(text);
}

function createGenerateWelcome(capability: AssistantCapability): ChatMessage[] {
  if (capability === 'ai') {
    return [
        {
          id: makeId('assistant'),
          role: 'assistant',
          text: '当前已进入 AI 模式。你可以先像和 GPT 一样确认目标、模块和风格；只有你明确说“开始生成”时，我才会真正开始构建页面。',
        },
    ];
  }

  return [
    {
      id: makeId('assistant'),
      role: 'assistant',
      text: '当前处于引导模式。我会先收集页面类型、目标用户、页面模块和整体风格，再生成一版初稿。',
    },
    {
      id: makeId('assistant'),
      role: 'assistant',
      text: '我们先从零生成一版模板。先告诉我你想做什么类型的页面，比如课程报名页、产品介绍页或者招聘专题页。',
    },
  ];
}

function createRefineWelcome(
  templateName: string,
  schemaSummary: string,
  capability: AssistantCapability,
): ChatMessage[] {
  if (capability === 'ai') {
    return [
        {
          id: makeId('assistant'),
          role: 'assistant',
          text: `当前已进入 AI 模式，我们可以围绕“${templateName}”继续聊天式调整。${schemaSummary}`,
        },
    ];
  }

  return [
    {
      id: makeId('assistant'),
      role: 'assistant',
      text: `现在进入基于模板继续修改的模式，我会围绕“${templateName}”继续调整。`,
    },
    {
      id: makeId('assistant'),
      role: 'assistant',
      text: `${schemaSummary} 你可以直接说“表单再详细一点”“多一张图片”或者“整体更简洁一些”。`,
    },
  ];
}

interface TemplateSidebarProps {
  assistantMode: AssistantMode;
  selectedTemplateId: string | null;
  publishedTemplates: TemplateSummary[];
  filteredPublishedTemplates: TemplateSummary[];
  templateKeyword: string;
  templateSourceFilter: TemplateSourceFilter;
  templateSortBy: TemplateSort;
  templateCardRefs: MutableRefObject<Record<string, HTMLButtonElement | null>>;
  onTemplateKeywordChange: (value: string) => void;
  onTemplateSourceFilterChange: (value: TemplateSourceFilter) => void;
  onTemplateSortByChange: (value: TemplateSort) => void;
  onTemplateSelect: (templateId: string) => void;
  onCreateNew: () => void;
  onLoadPublishedToEditor: () => void;
  canLoadPublishedToEditor: boolean;
}

function PublishedTemplateSidebar({
  assistantMode,
  selectedTemplateId,
  publishedTemplates,
  filteredPublishedTemplates,
  templateKeyword,
  templateSourceFilter,
  templateSortBy,
  templateCardRefs,
  onTemplateKeywordChange,
  onTemplateSourceFilterChange,
  onTemplateSortByChange,
  onTemplateSelect,
  onCreateNew,
  onLoadPublishedToEditor,
  canLoadPublishedToEditor,
}: TemplateSidebarProps) {
  return (
    <aside className="published-sidebar published-sticky-side">
      <div className="published-toolbar">
        <div className="published-section-title">模板列表</div>
        <span className="published-mode-badge">{assistantMode === 'refine' ? '修改模式' : '生成模式'}</span>
      </div>

      <div className="template-filter-stack published-filter-stack">
        <input
          value={templateKeyword}
          onChange={(event) => onTemplateKeywordChange(event.target.value)}
          placeholder="搜索模板名称"
        />
        <div className="template-filter-row">
          <select value={templateSortBy} onChange={(event) => onTemplateSortByChange(event.target.value as TemplateSort)}>
            <option value="published">最近发布</option>
            <option value="updated">最近更新</option>
            <option value="name">名称 A-Z</option>
          </select>
          <select
            value={templateSourceFilter}
            onChange={(event) => onTemplateSourceFilterChange(event.target.value as TemplateSourceFilter)}
          >
            <option value="all">全部来源</option>
            <option value="manual">手工搭建</option>
            <option value="ai">AI 生成</option>
            <option value="imported">导入模板</option>
          </select>
        </div>
      </div>

      {filteredPublishedTemplates.length ? (
        <div className="published-list">
          {filteredPublishedTemplates.map((template) => (
            <button
              key={template.id}
              ref={(element) => {
                templateCardRefs.current[template.id] = element;
              }}
              type="button"
              className={`published-card ${assistantMode === 'refine' && template.id === selectedTemplateId ? 'active' : ''}`}
              onClick={() => onTemplateSelect(template.id)}
            >
              <strong>{template.name}</strong>
              <div className="template-tag-row">
                <span className="template-source-tag">{getTemplateSourceLabel(template.source)}</span>
                <span className="template-status-tag">{template.hasPublished ? '已发布' : '草稿'}</span>
              </div>
              <span>
                {template.publishedAt
                  ? `发布时间：${new Date(template.publishedAt).toLocaleString()}`
                  : `最近更新：${new Date(template.updatedAt).toLocaleString()}`}
              </span>
              <span className="published-card-hint">点击后可继续修改这份模板</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="published-empty">
          {publishedTemplates.length
            ? '当前筛选条件下没有匹配的模板。'
            : '当前还没有模板。可以先在编辑器里发布一份，或者直接使用下方的 AI 生成功能。'}
        </div>
      )}

      <div className="published-sidebar-footer">
        <button
          type="button"
          className={`published-secondary-action ${assistantMode === 'generate' ? 'active' : ''}`}
          onClick={onCreateNew}
        >
          新建一版模板
        </button>

        {canLoadPublishedToEditor ? (
          <button type="button" onClick={onLoadPublishedToEditor}>
            载入当前发布版本到编辑器
          </button>
        ) : null}
      </div>
    </aside>
  );
}

interface AssistantPanelProps {
  assistantMode: AssistantMode;
  assistantCapability: AssistantCapability;
  selectedTemplateName: string | null;
  prompt: string;
  messages: ChatMessage[];
  assistantBusy: boolean;
  generateStep: GenerateStep;
  generateIntent: GenerateIntent;
  hasPreviewSchema: boolean;
  onPromptChange: (value: string) => void;
  onPromptKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: () => void;
  onAbort: () => void;
  onQuickReply: (text: string) => void;
}

function AssistantConversationPanel({
  assistantMode,
  assistantCapability,
  selectedTemplateName,
  prompt,
  messages,
  assistantBusy,
  generateStep,
  generateIntent,
  hasPreviewSchema,
  onPromptChange,
  onPromptKeyDown,
  onSubmit,
  onAbort,
  onQuickReply,
}: AssistantPanelProps) {
  const helperText = getAssistantHelperText({
    assistantCapability,
    assistantMode,
    selectedTemplateName,
    hasPreviewSchema,
  });
  const promptPlaceholder = getPromptPlaceholder({
    assistantMode,
    assistantCapability,
    generateStep,
    hasPreviewSchema,
  });
  const submitButtonText = getSubmitButtonText({
    assistantBusy,
    assistantCapability,
    assistantMode,
    generateStep,
    hasPreviewSchema,
  });
  const showQuickReplies = assistantCapability === 'fallback';
  const isAiMode = assistantCapability === 'ai';

  return (
    <aside className="ai-assistant-panel published-sticky-side">
      <div className="published-toolbar">
        <div className="published-section-title">对话修改区</div>
        <span className="published-mode-badge">{getAssistantCapabilityLabel(assistantCapability)}</span>
      </div>

      <div className="assistant-helper-text">{helperText}</div>

      <div className="chat-thread">
        {messages.map((message) => (
          <div key={message.id} className={`chat-bubble ${message.role}`}>
            {message.text}
          </div>
        ))}
        {assistantBusy ? (
          <div className="chat-bubble assistant">
            {isAiMode ? 'AI 正在处理这条消息，请稍等...' : 'AI 正在分析你的需求并生成新结果，请稍等...'}
          </div>
        ) : null}
      </div>

      {showQuickReplies ? (
        <div className="quick-reply-row">
          {(assistantMode === 'refine' ? refineReplies : generateReplies[generateStep]).map((item) => (
            <button
              key={item}
              type="button"
              className="quick-reply-chip"
              disabled={assistantBusy}
              onClick={() => onQuickReply(item)}
            >
              {item}
            </button>
          ))}
        </div>
      ) : null}

      {assistantMode === 'generate' && showQuickReplies ? (
        <div className="assistant-progress">
          <span className={generateStep === 'scene' ? 'active' : generateIntent.scene ? 'done' : ''}>页面类型</span>
          <span className={generateStep === 'audience' ? 'active' : generateIntent.audience ? 'done' : ''}>目标用户</span>
          <span className={generateStep === 'modules' ? 'active' : generateIntent.modules ? 'done' : ''}>页面模块</span>
          <span className={generateStep === 'style' ? 'active' : generateStep === 'done' ? 'done' : ''}>风格细化</span>
        </div>
      ) : null}

      <div className="ai-prompt-box">
        <textarea
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={onPromptKeyDown}
          placeholder={promptPlaceholder}
        />
        <button type="button" onClick={onSubmit} disabled={assistantBusy}>
          {submitButtonText}
        </button>
        {assistantBusy ? (
          <button type="button" className="published-secondary-action" onClick={onAbort}>
            停止生成
          </button>
        ) : null}
      </div>
    </aside>
  );
}

interface PublishedPageProps {
  currentUser: AuthSession;
}

export function PublishedPage({ currentUser }: PublishedPageProps) {
  const navigate = useNavigate();
  const templates = useEditorStore((state) => state.templates);
  const loadSchema = useEditorStore((state) => state.loadSchema);
  const loadTemplatePublished = useEditorStore((state) => state.loadTemplatePublished);
  const createTemplateFromSchema = useEditorStore((state) => state.createTemplateFromSchema);
  const importTemplateFile = useEditorStore((state) => state.importTemplateFile);
  const exportTemplateFile = useEditorStore((state) => state.exportTemplateFile);
  const getTemplateDetail = useEditorStore((state) => state.getTemplateDetail);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const templateCardRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const lastImportedTemplateIdRef = useRef<string | null>(null);
  const messagesRef = useRef<ChatMessage[]>([]);
  const activeStreamControllerRef = useRef<AbortController | null>(null);

  const [assistantMode, setAssistantMode] = useState<AssistantMode>('generate');
  const [assistantCapability, setAssistantCapability] = useState<AssistantCapability>('checking');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [fileActionMessage, setFileActionMessage] = useState('');
  const [assistantBusy, setAssistantBusy] = useState(false);
  const [previousResponseId, setPreviousResponseId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => createGenerateWelcome('checking'));
  const [generateStep, setGenerateStep] = useState<GenerateStep>('scene');
  const [generateIntent, setGenerateIntent] = useState<GenerateIntent>({
    scene: '',
    audience: '',
    modules: '',
    style: '',
    extraNotes: [],
  });
  const [generatedResult, setGeneratedResult] = useState<AiTemplateResult | null>(null);
  const [refinedResult, setRefinedResult] = useState<AiTemplateResult | null>(null);
  const [selectedTemplateDetail, setSelectedTemplateDetail] = useState<SavedTemplate | null>(null);
  const [templateKeyword, setTemplateKeyword] = useState('');
  const [templateSourceFilter, setTemplateSourceFilter] = useState<TemplateSourceFilter>('all');
  const [templateSortBy, setTemplateSortBy] = useState<TemplateSort>('published');

  const publishedTemplates = useMemo(
    () =>
      templates.filter(
        (item) =>
          item.hasPublished ||
          item.id === selectedTemplateId ||
          item.id === lastImportedTemplateIdRef.current,
      ),
    [templates, selectedTemplateId],
  );
  const filteredPublishedTemplates = useMemo(
    () => filterAndSortTemplates(publishedTemplates, templateKeyword, templateSourceFilter, templateSortBy),
    [publishedTemplates, templateKeyword, templateSourceFilter, templateSortBy],
  );

  const selectedTemplate = publishedTemplates.find((item) => item.id === selectedTemplateId) ?? null;
  const selectedTemplateSchema =
    selectedTemplateDetail?.publishedSchema ?? selectedTemplateDetail?.draftSchema ?? null;
  const isAiMode = assistantCapability === 'ai';
  const isFallbackMode = assistantCapability === 'fallback';
  const generatedConversationSchema = refinedResult?.schema ?? generatedResult?.schema ?? null;
  const activeConversationSchema =
    assistantMode === 'refine'
      ? refinedResult?.schema ?? selectedTemplateSchema
      : generatedConversationSchema;

  const previewSchema =
    assistantMode === 'refine'
      ? refinedResult?.schema ?? selectedTemplateSchema
      : generatedConversationSchema;

  const previewTitle =
    assistantMode === 'refine'
      ? refinedResult
        ? `修改结果预览 · ${selectedTemplate?.name ?? '当前模板'}`
        : selectedTemplate?.name ?? '当前模板'
      : generatedResult
        ? '生成结果预览'
        : '模板预览区';

  const previewDescription =
    assistantMode === 'refine'
      ? refinedResult?.summary ?? selectedTemplateSchema?.pageMeta.description ?? '基于当前模板继续修改。'
      : previewSchema
        ? '当前结果已经生成，可以继续通过右侧对话直接调整。'
        : '左侧可以选择模板继续修改，也可以直接从零生成一版。';

  const pushMessage = (role: 'assistant' | 'user', text: string) => {
    setMessages((prev) => [...prev, { id: makeId(role), role, text }]);
  };

  const createAssistantStreamMessage = () => {
    const id = makeId('assistant');
    setMessages((prev) => [...prev, { id, role: 'assistant', text: '' }]);
    return id;
  };

  const setAssistantMessageText = (id: string, text: string) => {
    setMessages((prev) => prev.map((message) => (message.id === id ? { ...message, text } : message)));
  };

  const appendAssistantMessageText = (id: string, chunk: string) => {
    setMessages((prev) =>
      prev.map((message) =>
        message.id === id ? { ...message, text: `${message.text}${chunk}` } : message,
      ),
    );
  };

  const pushSuggestions = (suggestions: string[]) => {
    if (!suggestions.length) return;
    pushMessage('assistant', suggestions.join(' '));
  };

  const openRefineSession = (
    templateId: string,
    templateName: string,
    detail: SavedTemplate | null,
    schemaSummary: string,
  ) => {
    setAssistantMode('refine');
    setSelectedTemplateId(templateId);
    setSelectedTemplateDetail(detail);
    setPrompt('');
    setPreviousResponseId(null);
    setGeneratedResult(null);
    setRefinedResult(null);
    setMessages(createRefineWelcome(templateName, schemaSummary, assistantCapability));
  };

  const resetToGenerateMode = () => {
    setAssistantMode('generate');
    setSelectedTemplateId(null);
    setSelectedTemplateDetail(null);
    setPrompt('');
    setPreviousResponseId(null);
    setGeneratedResult(null);
    setRefinedResult(null);
    setGenerateStep('scene');
    setGenerateIntent({
      scene: '',
      audience: '',
      modules: '',
      style: '',
      extraNotes: [],
    });
    setMessages(createGenerateWelcome(assistantCapability));
  };

  const enterRefineMode = async (templateId: string) => {
    const template = publishedTemplates.find((item) => item.id === templateId);
    if (!template) return;

    const detail = await getTemplateDetail(templateId);
    const schema = detail?.publishedSchema ?? detail?.draftSchema;
    if (!schema) return;

    openRefineSession(templateId, template.name, detail, summarizeSchema(schema));
  };

  const runFallbackGenerate = (nextIntent: GenerateIntent) => {
    const fullPrompt = buildGeneratePrompt(nextIntent);
    setAssistantBusy(true);
    const result = generateTemplateFromPrompt(fullPrompt);
    setGeneratedResult(result);
    setGenerateStep('done');
    setAssistantBusy(false);
  };

  const runAiConversation = async (content: string) => {
    const value = content.trim();
    if (!value) return;

    const nextMessages = [...messagesRef.current, { id: makeId('user'), role: 'user' as const, text: value }];
    pushMessage('user', value);
    setAssistantBusy(true);
    const streamMessageId = createAssistantStreamMessage();
    const controller = new AbortController();
    activeStreamControllerRef.current = controller;

    try {
      // 第一段先走 chat：让模型先完成自然对话和意图判断，再决定要不要进入 generate/refine。
      const chatResult = await chatTemplateByAIStream({
        message: value,
        currentSchema: activeConversationSchema,
        previousResponseId,
        conversationHistory: messagesRef.current.slice(-8).map((message) => ({
          role: message.role,
          text: message.text,
        })),
      }, {
        onStatus: (text) => {
          if (!text) return;
          setAssistantMessageText(streamMessageId, text);
        },
        onReplyDelta: (text) => {
          if (!text) return;
          appendAssistantMessageText(streamMessageId, text);
        },
      }, {
        signal: controller.signal,
      });

      setPreviousResponseId(chatResult.responseId ?? null);
      setAssistantMessageText(streamMessageId, chatResult.reply);

      if (chatResult.intent === 'generate' && chatResult.actionPrompt.trim()) {
        const generationMessageId = createAssistantStreamMessage();
        try {
          // 第二段再走 generate：把整理后的 actionPrompt 当成真正的页面生成指令。
          const result = await generateTemplateByAIStream({
            prompt: buildActionPrompt(nextMessages, chatResult.actionPrompt, 'generate'),
            previousResponseId: chatResult.responseId ?? previousResponseId,
          }, {
            onStatus: (text) => {
              if (!text) return;
              setAssistantMessageText(generationMessageId, text);
            },
          }, {
            signal: controller.signal,
          });
          setPreviousResponseId(result.responseId ?? chatResult.responseId ?? null);
          setGeneratedResult(result);
          setRefinedResult(null);
          setAssistantMessageText(
            generationMessageId,
            '我已经把刚才确认好的方向落成页面草稿，左侧预览已经同步更新。接下来我们可以继续围绕这版结果慢慢调整。',
          );
        } catch (error) {
          setAssistantCapability('fallback');
          setPreviousResponseId(null);
          const fallbackResult = generateTemplateFromPrompt(chatResult.actionPrompt);
          setGeneratedResult(fallbackResult);
          setRefinedResult(null);
          setAssistantMessageText(
            generationMessageId,
            `真实 AI 当前不稳定，我已切换到本地规则继续生成首版页面：${error instanceof Error ? error.message : '未知错误'}`,
          );
          pushMessage('assistant', fallbackResult.summary);
          pushSuggestions(fallbackResult.suggestions);
        }
        return;
      }

      if (chatResult.intent === 'refine' && chatResult.actionPrompt.trim() && activeConversationSchema) {
        const refineMessageId = createAssistantStreamMessage();
        setAssistantMessageText(refineMessageId, '我已经理解了这次修改意图，正在把它落到当前页面结构上...');
        // 修改链路目前采用“AI 理解 + 本地规则落地”，优先保证结构稳定。
        const fallbackResult = refineTemplateFromPrompt(
          activeConversationSchema,
          chatResult.actionPrompt || value,
        );
        setPreviousResponseId(chatResult.responseId ?? null);
        setRefinedResult(fallbackResult);
        setAssistantMessageText(
          refineMessageId,
          '我已经按刚才确认好的方向更新了当前页面，左侧预览也一起刷新了。你可以继续提想法，我会继续陪你往下调。',
        );
        pushSuggestions(fallbackResult.suggestions);
      }
    } catch (error) {
      if (isAbortError(error)) {
        setAssistantMessageText(streamMessageId, '本次生成已中断，你可以继续补充要求后重新开始。');
        return;
      }
      if (assistantMode === 'refine' && activeConversationSchema) {
        setAssistantCapability('fallback');
        setPreviousResponseId(null);
        const fallbackResult = refineTemplateFromPrompt(activeConversationSchema, value);
        setRefinedResult(fallbackResult);
        setAssistantMessageText(
          streamMessageId,
          `真实 AI 当前不稳定，我已直接切换到本地规则继续修改当前页面：${error instanceof Error ? error.message : '未知错误'}`,
        );
        pushMessage('assistant', fallbackResult.summary);
        pushSuggestions(fallbackResult.suggestions);
      } else if (assistantMode === 'generate' && shouldFallbackToGenerate(value)) {
        setAssistantCapability('fallback');
        setPreviousResponseId(null);
        const fallbackResult = generateTemplateFromPrompt(value);
        setGeneratedResult(fallbackResult);
        setRefinedResult(null);
        setAssistantMessageText(
          streamMessageId,
          `真实 AI 当前不稳定，我已直接切换到本地规则生成首版页面：${error instanceof Error ? error.message : '未知错误'}`,
        );
        pushMessage('assistant', fallbackResult.summary);
        pushSuggestions(fallbackResult.suggestions);
      } else {
        setAssistantMessageText(
          streamMessageId,
          `这次对话失败了，请重试。${error instanceof Error ? `原因：${error.message}` : ''}`.trim(),
        );
      }
    } finally {
      if (activeStreamControllerRef.current === controller) {
        activeStreamControllerRef.current = null;
      }
      setAssistantBusy(false);
    }
  };

  const handleGenerateConversation = (content: string) => {
    const value = content.trim();
    if (!value) return;

    if (isAiMode) {
      void runAiConversation(value);
      return;
    }

    pushMessage('user', value);

    if (generateStep === 'scene') {
      setGenerateIntent((prev) => ({ ...prev, scene: value }));
      setGenerateStep('audience');
      pushMessage('assistant', `收到。我先按“${value}”理解。接下来确认一下，这个页面主要面向谁？`);
      return;
    }

    if (generateStep === 'audience') {
      setGenerateIntent((prev) => ({ ...prev, audience: value }));
      setGenerateStep('modules');
      pushMessage('assistant', `明白了，目标用户是“${value}”。接下来告诉我页面里最需要哪些模块。`);
      return;
    }

    if (generateStep === 'modules') {
      setGenerateIntent((prev) => ({ ...prev, modules: value }));
      setGenerateStep('style');
      pushMessage('assistant', '好的，模块我记下了。最后再补充一下整体风格，或者你希望表单收集得更详细一点。');
      return;
    }

    if (generateStep === 'style') {
      const nextIntent = { ...generateIntent, style: value };
      setGenerateIntent(nextIntent);
      runFallbackGenerate(nextIntent);
      return;
    }

    const nextIntent = {
      ...generateIntent,
      extraNotes: [...generateIntent.extraNotes, value],
    };
    setGenerateIntent(nextIntent);
    pushMessage('assistant', '我会按你刚补充的要求继续调整，并刷新右侧预览。');
    runFallbackGenerate(nextIntent);
  };

  const handleRefineConversation = async (content: string) => {
    const value = content.trim();
    const baseSchema = activeConversationSchema;
    if (!value || !baseSchema) return;

    pushMessage('user', value);
    setAssistantBusy(true);
    const streamMessageId = createAssistantStreamMessage();
    const controller = new AbortController();
    activeStreamControllerRef.current = controller;

    let result: AiTemplateResult;
    try {
      // refine 会优先尝试真实 AI；只有失败时才切到本地规则兜底。
      const aiResult = await refineTemplateByAIStream({
        prompt: value,
        baseSchema,
        previousResponseId,
      }, {
        onStatus: (text) => {
          if (!text) return;
          setAssistantMessageText(streamMessageId, text);
        },
      }, {
        signal: controller.signal,
      });
      setPreviousResponseId(aiResult.responseId ?? null);
      result = aiResult;
    } catch (error) {
      if (isAbortError(error)) {
        setAssistantMessageText(streamMessageId, '本次修改已中断，当前页面保持不变，你可以继续重新描述。');
        if (activeStreamControllerRef.current === controller) {
          activeStreamControllerRef.current = null;
        }
        setAssistantBusy(false);
        return;
      }
      setAssistantCapability('fallback');
      setPreviousResponseId(null);
      setAssistantMessageText(
        streamMessageId,
        `真实 AI 当前不可用，已切换到引导模式：${error instanceof Error ? error.message : '未知错误'}`,
      );
      result = refineTemplateFromPrompt(baseSchema, value);
    }

    setRefinedResult(result);
    pushMessage('assistant', result.summary);
    pushSuggestions(result.suggestions);
    if (activeStreamControllerRef.current === controller) {
      activeStreamControllerRef.current = null;
    }
    setAssistantBusy(false);
  };

  const handleAbortAssistant = () => {
    activeStreamControllerRef.current?.abort();
    activeStreamControllerRef.current = null;
  };

  const handleSubmit = () => {
    const value = prompt.trim();
    if (!value || assistantBusy) return;

    if (isAiMode) {
      handleGenerateConversation(value);
    } else if (assistantMode === 'refine') {
      void handleRefineConversation(value);
    } else {
      handleGenerateConversation(value);
    }

    setPrompt('');
  };

  const handlePromptKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  const handleUseInEditor = async () => {
    if (!previewSchema) return;

    if (assistantMode === 'refine' && selectedTemplateId) {
      loadSchema(previewSchema, selectedTemplateId);
    } else {
      const templateId = await createTemplateFromSchema(previewSchema, previewSchema.pageMeta.title, {
        source: 'ai',
        publish: false,
      });
      loadSchema(previewSchema, templateId || null);
    }

    navigate('/editor');
  };

  const handleSavePreviewToTemplateCenter = async () => {
    if (!previewSchema) return;

    const templateId = await createTemplateFromSchema(previewSchema, previewSchema.pageMeta.title, {
      source: 'ai',
      publish: true,
    });
    if (!templateId) {
      setFileActionMessage('保存失败：当前页面结果未能通过模板创建校验。');
      return;
    }

    lastImportedTemplateIdRef.current = templateId;
    setFileActionMessage('已发布到模板中心，并自动选中当前模板。');
    const templateDetail: SavedTemplate = {
      id: templateId,
      name: previewSchema.pageMeta.title,
      draftSchema: previewSchema,
      publishedSchema: previewSchema,
      updatedAt: new Date().toISOString(),
      publishedAt: new Date().toISOString(),
      source: 'ai',
    };
    openRefineSession(templateId, previewSchema.pageMeta.title, templateDetail, summarizeSchema(previewSchema));
  };

  const handleLoadPublishedToEditor = async () => {
    if (!selectedTemplateId || !selectedTemplate?.hasPublished) return;
    await loadTemplatePublished(selectedTemplateId);
    navigate('/editor');
  };

  const handleImportButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleTemplateFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();

      try {
        const parsed = parseImportedJson(text);

        if (isObjectRecord(parsed) && 'type' in parsed) {
          if (parsed.type === TEMPLATE_FILE_TYPE) {
            if (!('template' in parsed)) {
              setFileActionMessage('不是合法模板文件：缺少 template 字段。');
              return;
            }
          } else if (typeof parsed.type === 'string') {
            setFileActionMessage(`不是合法模板文件：不支持的文件类型“${parsed.type}”。`);
            return;
          }
        } else if (!(isObjectRecord(parsed) && ('version' in parsed || 'pageMeta' in parsed || 'nodes' in parsed))) {
          setFileActionMessage('不是合法 Schema：文件内容不符合页面 Schema 结构。');
          return;
        }
      } catch {
        setFileActionMessage('JSON 格式错误：文件内容无法被解析为合法 JSON。');
        return;
      }

      const result = await importTemplateFile(text);
      setFileActionMessage(result.message);

      if (result.ok && result.templateId) {
        lastImportedTemplateIdRef.current = result.templateId;

        const importedTemplate = result.template ?? null;
        const importedSchema = importedTemplate?.publishedSchema ?? importedTemplate?.draftSchema;
        if (importedTemplate && importedSchema) {
          openRefineSession(
            result.templateId,
            importedTemplate.name,
            importedTemplate,
            summarizeSchema(importedSchema),
          );
        } else {
          setMessages([
            {
              id: makeId('assistant'),
              role: 'assistant',
              text: '模板导入成功，已自动定位到模板列表并选中当前模板。接下来可以继续对话修改，或先预览结构。',
            },
          ]);
        }
      }
    } finally {
      event.target.value = '';
    }
  };

  const handleExportCurrentTemplate = async () => {
    if (!selectedTemplateId) return;

    const result = await exportTemplateFile(selectedTemplateId);
    setFileActionMessage(result.message);

    if (result.ok && result.files?.length) {
      result.files.forEach((file: { filename: string; content: string; mimeType: string }, index: number) => {
        window.setTimeout(() => {
          triggerFileDownload(file.filename, file.content, file.mimeType);
        }, index * 120);
      });
    }
  };

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (assistantMode !== 'refine' || !selectedTemplateId) {
      return;
    }

    if (selectedTemplateDetail?.id === selectedTemplateId) {
      return;
    }

    let cancelled = false;

    const loadSelectedTemplateDetail = async () => {
      const detail = await getTemplateDetail(selectedTemplateId);
      if (!cancelled) {
        setSelectedTemplateDetail(detail);
      }
    };

    void loadSelectedTemplateDetail();

    return () => {
      cancelled = true;
    };
  }, [assistantMode, getTemplateDetail, selectedTemplateDetail?.id, selectedTemplateId]);

  useEffect(() => {
    if (!selectedTemplateId || lastImportedTemplateIdRef.current !== selectedTemplateId) {
      return;
    }

    const target = templateCardRefs.current[selectedTemplateId];
    if (!target) {
      return;
    }

    target.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
    target.focus({ preventScroll: true });
    lastImportedTemplateIdRef.current = null;
  }, [publishedTemplates, selectedTemplateId]);

  useEffect(() => {
    let cancelled = false;

    const checkAssistantCapability = async () => {
      try {
        const response = await fetch('/api/health');
        if (!response.ok) {
          throw new Error('AI 服务未启动。');
        }

        const data = (await response.json()) as { aiReady?: boolean };
        if (cancelled) return;

        setAssistantCapability(data.aiReady ? 'ai' : 'fallback');
      } catch {
        if (cancelled) return;
        setAssistantCapability('fallback');
      }
    };

    void checkAssistantCapability();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (assistantCapability === 'checking') {
      return;
    }

    if (assistantMode === 'refine' && selectedTemplate && selectedTemplateSchema) {
      setMessages(createRefineWelcome(selectedTemplate.name, summarizeSchema(selectedTemplateSchema), assistantCapability));
      return;
    }

    if (assistantMode === 'generate') {
      setMessages(createGenerateWelcome(assistantCapability));
    }
  }, [assistantCapability, assistantMode, selectedTemplate, selectedTemplateSchema]);

  return (
    <div className="published-page">
      <header className="published-hero">
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden-file-input"
          onChange={handleTemplateFileChange}
        />
        <div>
          <div className="published-eyebrow">Template Workspace</div>
          <h1>模板发布与修改</h1>
          <p>这里主要用于查看已发布模板，并演示通过自然语言继续生成或修改页面草案的过程。</p>
          {fileActionMessage ? <div className="published-file-message">{fileActionMessage}</div> : null}
        </div>
        <div className="published-hero-actions">
          {selectedTemplate ? (
            <button type="button" className="published-file-action" onClick={handleExportCurrentTemplate}>
              <span className="published-action-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" focusable="false">
                  <path d="M7 3.75A2.25 2.25 0 0 0 4.75 6v12A2.25 2.25 0 0 0 7 20.25h10A2.25 2.25 0 0 0 19.25 18V8.56a2.25 2.25 0 0 0-.66-1.59l-2.56-2.56a2.25 2.25 0 0 0-1.59-.66H7Z" />
                  <path d="M14 3.75V8a1 1 0 0 0 1 1h4.25" />
                  <path d="M12 10.75v5.5" />
                  <path d="m9.75 14 2.25 2.25L14.25 14" />
                </svg>
              </span>
              导出当前模板
            </button>
          ) : null}

          <button type="button" className="published-file-action" onClick={handleImportButtonClick}>
            <span className="published-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M7 3.75A2.25 2.25 0 0 0 4.75 6v12A2.25 2.25 0 0 0 7 20.25h10A2.25 2.25 0 0 0 19.25 18V8.56a2.25 2.25 0 0 0-.66-1.59l-2.56-2.56a2.25 2.25 0 0 0-1.59-.66H7Z" />
                <path d="M14 3.75V8a1 1 0 0 0 1 1h4.25" />
                <path d="M12 16.25v-5.5" />
                <path d="m9.75 13 2.25-2.25L14.25 13" />
              </svg>
            </span>
            导入模板文件
          </button>

          <button type="button">{currentUser.displayName}</button>
          <button type="button" onClick={() => navigate('/editor')}>返回编辑器</button>
        </div>
      </header>

      <div className="published-layout">
        <PublishedTemplateSidebar
          assistantMode={assistantMode}
          selectedTemplateId={selectedTemplateId}
          publishedTemplates={publishedTemplates}
          filteredPublishedTemplates={filteredPublishedTemplates}
          templateKeyword={templateKeyword}
          templateSourceFilter={templateSourceFilter}
          templateSortBy={templateSortBy}
          templateCardRefs={templateCardRefs}
          onTemplateKeywordChange={setTemplateKeyword}
          onTemplateSourceFilterChange={setTemplateSourceFilter}
          onTemplateSortByChange={setTemplateSortBy}
          onTemplateSelect={enterRefineMode}
          onCreateNew={resetToGenerateMode}
          onLoadPublishedToEditor={handleLoadPublishedToEditor}
          canLoadPublishedToEditor={assistantMode === 'refine' && Boolean(selectedTemplate?.hasPublished)}
        />

        <main className="published-main">
          {previewSchema ? (
            <SchemaPreview schema={previewSchema} title={previewTitle} description={previewDescription} />
          ) : (
            <div className="published-empty large">左侧可以选择模板继续修改，也可以从零生成一版新的页面模板。</div>
          )}

          {previewSchema ? (
            <div className="generated-actions">
              <button type="button" onClick={handleUseInEditor}>用这份结果进入编辑器</button>
              <button type="button" onClick={handleSavePreviewToTemplateCenter}>直接发布到模板中心</button>
            </div>
          ) : null}
        </main>

        <AssistantConversationPanel
          assistantMode={assistantMode}
          assistantCapability={assistantCapability}
          selectedTemplateName={selectedTemplate?.name ?? null}
          prompt={prompt}
          messages={messages}
          assistantBusy={assistantBusy}
          generateStep={generateStep}
          generateIntent={generateIntent}
          hasPreviewSchema={Boolean(previewSchema)}
          onPromptChange={setPrompt}
          onPromptKeyDown={handlePromptKeyDown}
          onSubmit={handleSubmit}
          onAbort={handleAbortAssistant}
          onQuickReply={(item) => {
            if (assistantMode === 'refine') {
              void handleRefineConversation(item);
            } else {
              handleGenerateConversation(item);
            }
          }}
        />
      </div>
    </div>
  );
}






