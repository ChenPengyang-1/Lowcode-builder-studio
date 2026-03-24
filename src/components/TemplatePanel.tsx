import { useMemo, useState } from 'react';
import { useEditorStore } from '../store/editorStore';

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
  const activeTemplate = useMemo(
    () => templates.find((item) => item.id === activeTemplateId) ?? null,
    [templates, activeTemplateId],
  );

  // 这个面板是模板生命周期入口，负责创建、存草稿、发布、回载和删除。
  return (
    <aside className="panel template-panel panel-accent-violet">
      <div className="panel-title">模板中心</div>
      <div className="template-panel-summary">
        保存当前页面为模板，管理草稿和发布版本。
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
          <div className="template-meta-line">
            {activeTemplate.publishedSchema ? '已存在已发布版本' : '目前仅有草稿'}
          </div>
          <div className="template-inline-actions compact-grid">
            <button type="button" onClick={() => updateTemplateDraft(activeTemplate.id)}>保存草稿</button>
            <button type="button" onClick={() => publishTemplate(activeTemplate.id)}>发布当前页</button>
          </div>
        </div>
      ) : null}

      <div className="template-list">
        {templates.length ? (
          templates.map((template) => (
            <div key={template.id} className={`template-card ${template.id === activeTemplateId ? 'active' : ''}`}>
              <input
                className="template-name-input"
                value={template.name}
                onChange={(event) => renameTemplate(template.id, event.target.value)}
              />
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
          <div className="empty-tip">还没有模板，先把当前页面保存成一个模板。</div>
        )}
      </div>
    </aside>
  );
}
