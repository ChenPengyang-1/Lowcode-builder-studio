import { useDraggable } from '@dnd-kit/core';
import { flattenNodes } from '../utils/tree';
import { useEditorStore } from '../store/editorStore';

function LayerItem({
  id,
  name,
  type,
  depth,
  active,
  onClick,
}: {
  id: string;
  name: string;
  type: string;
  depth: number;
  active: boolean;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `node:${id}:layer`,
    data: {
      kind: 'node',
      nodeId: id,
    },
  });

  return (
    <button
      ref={setNodeRef}
      className={`layer-item ${active ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={onClick}
      style={{
        paddingLeft: 12 + depth * 18,
      }}
      title="拖到画布插槽中完成重排"
      {...listeners}
      {...attributes}
    >
      <span>{name}</span>
      <small>{type}</small>
    </button>
  );
}

export function LayerPanel() {
  const schema = useEditorStore((state) => state.schema);
  const selectedId = useEditorStore((state) => state.selectedId);
  const selectNode = useEditorStore((state) => state.selectNode);
  const moveSelected = useEditorStore((state) => state.moveSelected);

  const list = flattenNodes(schema.nodes);

  return (
    <aside className="panel layer-panel panel-accent-cyan">
      <div className="panel-title">图层树</div>
      <div className="panel-description">查看页面结构、快速选中节点，也可以直接拖到画布插槽里调整层级和顺序。</div>
      <div className="layer-actions">
        <button onClick={() => moveSelected('up')} disabled={!selectedId}>
          上移
        </button>
        <button onClick={() => moveSelected('down')} disabled={!selectedId}>
          下移
        </button>
      </div>
      <div className="layer-list">
        {list.map((node) => (
          <LayerItem
            key={node.id}
            id={node.id}
            name={node.name}
            type={node.type}
            depth={node.depth}
            active={selectedId === node.id}
            onClick={() => selectNode(node.id)}
          />
        ))}
      </div>
    </aside>
  );
}
