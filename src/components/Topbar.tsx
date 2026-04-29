import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useEditorStore } from '../store/editorStore';

function getTemplateStatusText(templateName: string, hasPublished: boolean) {
  return `当前模板：${templateName} · ${hasPublished ? '已有发布版本' : '暂未发布'}`;
}

function getModeButtonText(mode: 'edit' | 'preview') {
  return mode === 'edit' ? '切换预览' : '返回编辑';
}

export function Topbar() {
  const navigate = useNavigate();
  const mode = useEditorStore((state) => state.mode);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore((state) => state.canUndo);
  const canRedo = useEditorStore((state) => state.canRedo);
  const toggleMode = useEditorStore((state) => state.toggleMode);
  const exportSchema = useEditorStore((state) => state.exportSchema);
  const importSchema = useEditorStore((state) => state.importSchema);
  const deleteSelected = useEditorStore((state) => state.deleteSelected);
  const duplicateSelected = useEditorStore((state) => state.duplicateSelected);
  const resetDemo = useEditorStore((state) => state.resetDemo);
  const activeTemplateId = useEditorStore((state) => state.activeTemplateId);
  const templates = useEditorStore((state) => state.templates);
  const updateTemplateDraft = useEditorStore((state) => state.updateTemplateDraft);
  const publishTemplate = useEditorStore((state) => state.publishTemplate);

  const [jsonText, setJsonText] = useState('');
  const [message, setMessage] = useState('');

  const activeTemplate = templates.find((item) => item.id === activeTemplateId) ?? null;
  const activeTemplateStatus = activeTemplate
    ? getTemplateStatusText(activeTemplate.name, activeTemplate.hasPublished)
    : '当前页面还没有保存为模板，可以先在左侧模板中心创建一份。';

  const handleExportSchema = () => {
    setJsonText(exportSchema());
  };

  const handleImportSchema = () => {
    const result = importSchema(jsonText);
    setMessage(result.message);
  };

  const handlePublishTemplate = async () => {
    if (!activeTemplate) return;
    await publishTemplate(activeTemplate.id);
    navigate('/published');
  };

  return (
    <div className="top-shell">
      <div className="top-hero">
        <div className="topbar-eyebrow">Low-Code Marketing Studio</div>
        <div className="topbar-title-row">
          <div className="topbar-copy">
            <div className="topbar-title">低代码页面搭建平台</div>
            <div className="topbar-subtitle">
              用来演示页面编排、模板保存发布、Schema 导入导出，以及基于对话的模板生成与修改。
            </div>
          </div>

          <div className="topbar-pills" aria-label="tech stack">
            <span>React 18</span>
            <span>TypeScript</span>
            <span>Zustand</span>
          </div>
        </div>
      </div>

      <div className="toolbar-sticky">
        <div className="toolbar-main">
          <div>
            <div className="toolbar-actions">
              <button onClick={undo} disabled={!canUndo}>
                撤销
              </button>
              <button onClick={redo} disabled={!canRedo}>
                重做
              </button>
              <button onClick={duplicateSelected}>复制组件</button>
              <button onClick={deleteSelected}>删除组件</button>
              <button onClick={resetDemo}>恢复示例页</button>
              <button onClick={handleExportSchema}>导出 Schema</button>
              <button onClick={toggleMode}>{getModeButtonText(mode)}</button>
              <button onClick={() => navigate('/published')}>模板发布页</button>
              {activeTemplate ? (
                <button onClick={() => void updateTemplateDraft(activeTemplate.id)}>保存草稿</button>
              ) : null}
              {activeTemplate ? <button onClick={handlePublishTemplate}>发布当前页</button> : null}
            </div>
            <div className="toolbar-status-line">{activeTemplateStatus}</div>
          </div>

          <div className="schema-box compact">
            <textarea
              value={jsonText}
              onChange={(event) => setJsonText(event.target.value)}
              placeholder="这里可以查看或粘贴 Schema JSON，用于导入、导出和调试"
            />
            <div className="schema-actions">
              <button onClick={handleImportSchema}>导入 Schema</button>
              <span>{message}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
