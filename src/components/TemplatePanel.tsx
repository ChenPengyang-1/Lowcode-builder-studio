import { useEffect, useMemo, useRef, useState } from 'react';
import { useEditorStore } from '../store/editorStore';

type TemplateSort = 'updated' | 'published' | 'name';
type TemplateSourceFilter = 'all' | 'manual' | 'ai' | 'imported';

const TEMPLATE_SEARCH_DEBOUNCE = 300;
const TEMPLATE_ROW_HEIGHT = 236;
const TEMPLATE_LIST_HEIGHT = 520;
const TEMPLATE_OVERSCAN = 3;

function getTemplateSourceLabel(source: 'manual' | 'ai' | 'imported' | undefined) {
  if (source === 'ai') return 'AI 生成';
  if (source === 'imported') return '导入模板';
  return '手工搭建';
}

function useDebouncedValue<T>(value: T, delay: number) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [delay, value]);

  return debouncedValue;
}

export function TemplatePanel() {
  const templates = useEditorStore((state) => state.templates);
  const activeTemplateId = useEditorStore((state) => state.activeTemplateId);
  const saveAsTemplate = useEditorStore((state) => state.saveAsTemplate);
  const updateTemplateDraft = useEditorStore((state) => state.updateTemplateDraft);
  const publishTemplate = useEditorStore((state) => state.publishTemplate);
  const loadTemplateDraft = useEditorStore((state) => state.loadTemplateDraft);
  const loadTemplatePublished = useEditorStore((state) => state.loadTemplatePublished);
  const renameTemplate = useEditorStore((state) => state.renameTemplate);
  const deleteTemplate = useEditorStore((state) => state.deleteTemplate);
  const schema = useEditorStore((state) => state.schema);

  const [newName, setNewName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [sourceFilter, setSourceFilter] = useState<TemplateSourceFilter>('all');
  const [sortBy, setSortBy] = useState<TemplateSort>('updated');
  const [scrollTop, setScrollTop] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const debouncedKeyword = useDebouncedValue(keyword, TEMPLATE_SEARCH_DEBOUNCE);

  const activeTemplate = useMemo(
    () => templates.find((item) => item.id === activeTemplateId) ?? null,
    [templates, activeTemplateId],
  );

  const filteredTemplates = useMemo(() => {
    const normalizedKeyword = debouncedKeyword.trim().toLowerCase();

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

        if (sortBy === 'published') {
          return new Date(right.publishedAt ?? 0).getTime() - new Date(left.publishedAt ?? 0).getTime();
        }

        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      });
  }, [debouncedKeyword, sortBy, sourceFilter, templates]);

  useEffect(() => {
    setScrollTop(0);
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [debouncedKeyword, sortBy, sourceFilter]);

  const { visibleTemplates, topSpacer, bottomSpacer } = useMemo(() => {
    const visibleCount = Math.ceil(TEMPLATE_LIST_HEIGHT / TEMPLATE_ROW_HEIGHT) + TEMPLATE_OVERSCAN * 2;
    const startIndex = Math.max(0, Math.floor(scrollTop / TEMPLATE_ROW_HEIGHT) - TEMPLATE_OVERSCAN);
    const endIndex = Math.min(filteredTemplates.length, startIndex + visibleCount);

    return {
      visibleTemplates: filteredTemplates.slice(startIndex, endIndex),
      topSpacer: startIndex * TEMPLATE_ROW_HEIGHT,
      bottomSpacer: Math.max(0, (filteredTemplates.length - endIndex) * TEMPLATE_ROW_HEIGHT),
    };
  }, [filteredTemplates, scrollTop]);

  return (
    <aside className="panel template-panel panel-accent-violet">
      <div className="panel-title">模板中心</div>
      <div className="template-panel-summary">
        保存当前页面为模板，并统一管理草稿、发布版和导入模板。
      </div>

      <div className="template-filter-stack">
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜索模板名称"
        />
        <div className="template-filter-row">
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value as TemplateSort)}>
            <option value="updated">最近更新</option>
            <option value="published">最近发布</option>
            <option value="name">名称 A-Z</option>
          </select>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value as TemplateSourceFilter)}
          >
            <option value="all">全部来源</option>
            <option value="manual">手工搭建</option>
            <option value="ai">AI 生成</option>
            <option value="imported">导入模板</option>
          </select>
        </div>
      </div>

      <div className="template-create-row compact">
        <input
          value={newName}
          onChange={(event) => setNewName(event.target.value)}
          placeholder={`${schema.pageMeta.title} 模板`}
        />
        <button
          type="button"
          onClick={() => {
            void saveAsTemplate(newName);
            setNewName('');
          }}
        >
          保存为模板
        </button>
      </div>

      {activeTemplate ? (
        <div className="template-active-box compact">
          <div className="template-active-label">当前模板</div>
          <div className="template-active-title">{activeTemplate.name}</div>
          <div className="template-tag-row">
            <span className="template-source-tag">{getTemplateSourceLabel(activeTemplate.source)}</span>
            <span className="template-status-tag">{activeTemplate.hasPublished ? '已发布' : '草稿'}</span>
          </div>
          <div className="template-meta-line">
            {activeTemplate.hasPublished ? '当前模板已有发布版本' : '当前模板暂未发布'}
          </div>
          <div className="template-inline-actions compact-grid">
            <button type="button" onClick={() => void updateTemplateDraft(activeTemplate.id)}>保存草稿</button>
            <button type="button" onClick={() => void publishTemplate(activeTemplate.id)}>发布当前页</button>
          </div>
        </div>
      ) : null}

      <div
        ref={listRef}
        className="template-list template-virtual-list"
        onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
      >
        {filteredTemplates.length ? (
          <>
            <div style={{ height: topSpacer }} />
            {visibleTemplates.map((template) => (
              <div key={template.id} className="template-virtual-row">
                <div className={`template-card ${template.id === activeTemplateId ? 'active' : ''}`}>
                  <input
                    className="template-name-input"
                    value={template.name}
                    onChange={(event) => void renameTemplate(template.id, event.target.value)}
                  />
                  <div className="template-tag-row">
                    <span className="template-source-tag">{getTemplateSourceLabel(template.source)}</span>
                    <span className="template-status-tag">{template.hasPublished ? '已发布' : '草稿'}</span>
                  </div>
                  <div className="template-meta-line">
                    最近更新：{new Date(template.updatedAt).toLocaleString()}
                  </div>
                  <div className="template-meta-line">
                    节点数：草稿 {template.draftNodeCount}
                    {template.hasPublished ? ` / 发布 ${template.publishedNodeCount}` : ''}
                  </div>
                  <div className="template-inline-actions compact-grid">
                    <button type="button" onClick={() => void loadTemplateDraft(template.id)}>加载草稿</button>
                    <button
                      type="button"
                      onClick={() => void loadTemplatePublished(template.id)}
                      disabled={!template.hasPublished}
                    >
                      查看发布版
                    </button>
                    <button type="button" onClick={() => void updateTemplateDraft(template.id)}>覆盖草稿</button>
                    <button type="button" onClick={() => void publishTemplate(template.id)}>重新发布</button>
                    <button
                      type="button"
                      className="danger full-span"
                      onClick={() => void deleteTemplate(template.id)}
                    >
                      删除模板
                    </button>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ height: bottomSpacer }} />
          </>
        ) : (
          <div className="empty-tip">
            {templates.length ? '当前筛选条件下没有匹配的模板。' : '还没有模板，先把当前页面保存成一份模板。'}
          </div>
        )}
      </div>
    </aside>
  );
}
