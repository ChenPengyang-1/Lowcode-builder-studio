import { useMemo, useState } from 'react';
import { useEditorStore } from '../store/editorStore';

type TemplateSort = 'updated' | 'published' | 'name';
type TemplateSourceFilter = 'all' | 'manual' | 'ai' | 'imported';

function getTemplateSourceLabel(source: 'manual' | 'ai' | 'imported' | undefined) {
  if (source === 'ai') return 'AI 生成';
  if (source === 'imported') return '导入模板';
  return '手工搭建';
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

  const activeTemplate = useMemo(
    () => templates.find((item) => item.id === activeTemplateId) ?? null,
    [templates, activeTemplateId],
  );

  const filteredTemplates = useMemo(() => {
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

        if (sortBy === 'published') {
          return new Date(right.publishedAt ?? 0).getTime() - new Date(left.publishedAt ?? 0).getTime();
        }

        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      });
  }, [keyword, sortBy, sourceFilter, templates]);

  return (
    <aside className="panel template-panel panel-accent-violet">
      <div className="panel-title">模板中心</div>
      <div className="template-panel-summary">
        保存当前页面为模板，管理草稿和发布版本。
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
            saveAsTemplate(newName);
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
            <span className="template-status-tag">{activeTemplate.publishedSchema ? '已发布' : '草稿'}</span>
          </div>
          <div className="template-meta-line">
            {activeTemplate.publishedSchema ? '已存在已发布版本' : '当前仅有草稿'}
          </div>
          <div className="template-inline-actions compact-grid">
            <button type="button" onClick={() => updateTemplateDraft(activeTemplate.id)}>保存草稿</button>
            <button type="button" onClick={() => publishTemplate(activeTemplate.id)}>发布当前页</button>
          </div>
        </div>
      ) : null}

      <div className="template-list">
        {filteredTemplates.length ? (
          filteredTemplates.map((template) => (
            <div key={template.id} className={`template-card ${template.id === activeTemplateId ? 'active' : ''}`}>
              <input
                className="template-name-input"
                value={template.name}
                onChange={(event) => renameTemplate(template.id, event.target.value)}
              />
              <div className="template-tag-row">
                <span className="template-source-tag">{getTemplateSourceLabel(template.source)}</span>
                <span className="template-status-tag">{template.publishedSchema ? '已发布' : '草稿'}</span>
              </div>
              <div className="template-meta-line">最近更新：{new Date(template.updatedAt).toLocaleString()}</div>
              <div className="template-inline-actions compact-grid">
                <button type="button" onClick={() => loadTemplateDraft(template.id)}>加载草稿</button>
                <button
                  type="button"
                  onClick={() => loadTemplatePublished(template.id)}
                  disabled={!template.publishedSchema}
                >
                  查看发布版
                </button>
                <button type="button" onClick={() => updateTemplateDraft(template.id)}>覆盖草稿</button>
                <button type="button" onClick={() => publishTemplate(template.id)}>重新发布</button>
                <button type="button" className="danger full-span" onClick={() => deleteTemplate(template.id)}>删除模板</button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-tip">
            {templates.length ? '当前筛选条件下没有匹配的模板。' : '还没有模板，先把当前页面保存成一个模板。'}
          </div>
        )}
      </div>
    </aside>
  );
}
