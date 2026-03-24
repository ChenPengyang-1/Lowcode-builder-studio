import { materialRegistry } from '../materials/registry';
import { useEditorStore } from '../store/editorStore';

export function MaterialPanel() {
  const addMaterial = useEditorStore((state) => state.addMaterial);
  const setDragMaterialType = useEditorStore((state) => state.setDragMaterialType);

  return (
    <aside className="panel material-panel">
      <div className="panel-title">物料区</div>
      <div className="panel-description">点击可直接添加，也可拖到画布或容器中的蓝色插槽。</div>
      <div className="material-list">
        {materialRegistry.map((item) => (
          <button
            key={item.type}
            className="material-card"
            draggable
            onClick={() => addMaterial(item.type)}
            onDragStart={() => setDragMaterialType(item.type)}
            onDragEnd={() => setDragMaterialType(null)}
          >
            <strong>{item.label}</strong>
            <span>{item.description}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
