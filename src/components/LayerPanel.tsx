import { flattenNodes } from '../utils/tree';
import { useEditorStore } from '../store/editorStore';

export function LayerPanel() {
  const schema = useEditorStore((state) => state.schema);
  const selectedId = useEditorStore((state) => state.selectedId);
  const selectNode = useEditorStore((state) => state.selectNode);
  const moveSelected = useEditorStore((state) => state.moveSelected);
  const setDragNodeId = useEditorStore((state) => state.setDragNodeId);

  const list = flattenNodes(schema.nodes);

  return (
    <aside className="panel layer-panel panel-accent-cyan">
      <div className="panel-title">图层树</div>
      <div className="panel-description">查看页面结构，可快速选中节点，也可通过画布拖拽或这里的上下移动调整顺序。</div>
      <div className="layer-actions">
        <button onClick={() => moveSelected('up')} disabled={!selectedId}>上移</button>
        <button onClick={() => moveSelected('down')} disabled={!selectedId}>下移</button>
      </div>
      <div className="layer-list">
        {list.map((node) => (
          <button
            key={node.id}
            className={`layer-item ${selectedId === node.id ? 'active' : ''}`}
            onClick={() => selectNode(node.id)}
            style={{ paddingLeft: 12 + node.depth * 18 }}
            draggable
            onDragStart={() => setDragNodeId(node.id)}
            onDragEnd={() => setDragNodeId(null)}
            title="可在画布插槽中放下以完成重排"
          >
            <span>{node.name}</span>
            <small>{node.type}</small>
          </button>
        ))}
      </div>
    </aside>
  );
}
