import { useDndContext } from '@dnd-kit/core';
import { shallow } from 'zustand/shallow';
import { DropSlot } from './DropSlot';
import { Renderer } from '../renderer/Renderer';
import { useEditorStore } from '../store/editorStore';

function RootDropSlot({ index }: { index: number }) {
  const label = index === 0 ? '插入到页面顶部' : `插入到第 ${index} 个区块后`;

  return (
    <DropSlot
      parentId={null}
      index={index}
      position="root"
      label={label}
      className="drop-slot"
    />
  );
}

export function Canvas() {
  const { schema, selectedId, selectNode, mode, activeTemplateId, templates } = useEditorStore(
    (state) => ({
      schema: state.schema,
      selectedId: state.selectedId,
      selectNode: state.selectNode,
      mode: state.mode,
      activeTemplateId: state.activeTemplateId,
      templates: state.templates,
    }),
    shallow,
  );
  const { active } = useDndContext();

  const activeTemplate = templates.find((item) => item.id === activeTemplateId) ?? null;
  const isDragging = Boolean(active);

  return (
    <section className="canvas-wrap">
      <div className="canvas-header">
        <div>
          <div className="panel-title">{schema.pageMeta.title}</div>
          <div className="panel-description">{schema.pageMeta.description}</div>
          {activeTemplate ? (
            <div className="template-badge-inline">当前草稿来源：{activeTemplate.name}</div>
          ) : (
            <div className="template-badge-inline muted">当前为未保存草稿</div>
          )}
        </div>
        <div className="mode-badge">{mode === 'edit' ? '编辑态' : '预览态'}</div>
      </div>

      <div
        className={`canvas ${mode === 'preview' ? 'preview-mode' : ''} ${isDragging ? 'drag-over-ready' : ''}`}
        style={{ background: schema.pageMeta.background }}
        onClick={() => selectNode(null)}
      >
        {mode === 'edit' ? <RootDropSlot index={0} /> : null}

        {schema.nodes.length ? (
          schema.nodes.map((node, index) => (
            <div key={node.id} className="canvas-node-block">
              <Renderer
                node={node}
                selectedId={selectedId}
                mode={mode}
                onSelect={selectNode}
              />
              {mode === 'edit' ? <RootDropSlot index={index + 1} /> : null}
            </div>
          ))
        ) : (
          <div className="canvas-empty">
            {mode === 'edit' ? '从左侧拖入物料，或点击物料卡片开始搭建页面。' : '当前页面暂无内容。'}
          </div>
        )}
      </div>
    </section>
  );
}
