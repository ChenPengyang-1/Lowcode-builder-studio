import { Renderer } from '../renderer/Renderer';
import { useEditorStore } from '../store/editorStore';

// 根级落点用于接收物料新增和已有节点重排，支持插到页面任意位置。
function RootDropSlot({ index, active }: { index: number; active: boolean }) {
  const insertMaterial = useEditorStore((state) => state.insertMaterial);
  const moveNodeByDrop = useEditorStore((state) => state.moveNodeByDrop);
  const dragMaterialType = useEditorStore((state) => state.dragMaterialType);
  const dragNodeId = useEditorStore((state) => state.dragNodeId);
  const setDragMaterialType = useEditorStore((state) => state.setDragMaterialType);
  const setDragNodeId = useEditorStore((state) => state.setDragNodeId);

  return (
    <div
      className={`drop-slot ${active ? 'active' : ''}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        if (dragMaterialType) {
          insertMaterial(dragMaterialType, null, index);
          setDragMaterialType(null);
          return;
        }
        if (dragNodeId) {
          moveNodeByDrop(dragNodeId, null, index);
          setDragNodeId(null);
        }
      }}
    >
      <span>
        {index === 0 ? '插入到页面顶部' : `插入到第 ${index} 个区块后`}
      </span>
    </div>
  );
}

export function Canvas() {
  const schema = useEditorStore((state) => state.schema);
  const selectedId = useEditorStore((state) => state.selectedId);
  const selectNode = useEditorStore((state) => state.selectNode);
  const mode = useEditorStore((state) => state.mode);
  const dragMaterialType = useEditorStore((state) => state.dragMaterialType);
  const dragNodeId = useEditorStore((state) => state.dragNodeId);
  const insertMaterial = useEditorStore((state) => state.insertMaterial);
  const moveNodeByDrop = useEditorStore((state) => state.moveNodeByDrop);
  const activeTemplateId = useEditorStore((state) => state.activeTemplateId);
  const templates = useEditorStore((state) => state.templates);

  const activeTemplate = templates.find((item) => item.id === activeTemplateId) ?? null;

  return (
    <section className="canvas-wrap">
      {/* 画布头部用于提示当前正在编辑的是哪份页面/Schema。 */}
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
        className={`canvas ${mode === 'preview' ? 'preview-mode' : ''} ${(dragMaterialType || dragNodeId) ? 'drag-over-ready' : ''}`}
        style={{ background: schema.pageMeta.background }}
        onClick={() => selectNode(null)}
      >
        {/* 编辑态下，物料和节点都可以直接拖到第一个区块之前。 */}
        {(dragMaterialType || dragNodeId) && mode === 'edit' && <RootDropSlot index={0} active />}

        {schema.nodes.length ? (
          schema.nodes.map((node, index) => (
            <div key={node.id} className="canvas-node-block">
              <Renderer
                node={node}
                selectedId={selectedId}
                mode={mode}
                onSelect={selectNode}
                dragMaterialType={dragMaterialType}
                dragNodeId={dragNodeId}
                onDropMaterial={(parentId, childIndex) => {
                  if (dragMaterialType) {
                    insertMaterial(dragMaterialType, parentId, childIndex);
                  }
                }}
                onDropNode={(sourceId, parentId, childIndex) => {
                  moveNodeByDrop(sourceId, parentId, childIndex);
                }}
              />
              {(dragMaterialType || dragNodeId) && mode === 'edit' && <RootDropSlot index={index + 1} active />}
            </div>
          ))
        ) : (
          <div className="canvas-empty">从左侧选择物料，或直接拖入这里开始搭建页面。</div>
        )}
      </div>
    </section>
  );
}
