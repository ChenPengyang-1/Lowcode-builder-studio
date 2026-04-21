import { useDraggable } from '@dnd-kit/core';
import { useEffect, useRef } from 'react';
import { materialRegistry } from '../materials/registry';
import { useEditorStore } from '../store/editorStore';

function MaterialCard({
  type,
  label,
  description,
  onClick,
}: {
  type: (typeof materialRegistry)[number]['type'];
  label: string;
  description: string;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `material:${type}`,
    data: {
      kind: 'material',
      materialType: type,
    },
  });
  const hadDragRef = useRef(false);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    if (isDragging) {
      hadDragRef.current = true;
      return;
    }

    if (hadDragRef.current) {
      hadDragRef.current = false;
      suppressClickRef.current = true;
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
    }
  }, [isDragging]);

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={`material-card ${isDragging ? 'dragging' : ''}`}
      onClick={(event) => {
        if (suppressClickRef.current) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        onClick();
      }}
      {...listeners}
      {...attributes}
    >
      <strong>{label}</strong>
      <span>{description}</span>
    </button>
  );
}

export function MaterialPanel() {
  const addMaterial = useEditorStore((state) => state.addMaterial);

  return (
    <aside className="panel material-panel">
      <div className="panel-title">物料区</div>
      <div className="panel-description">点击可直接插入，也可以拖到画布或容器里的插槽中。</div>
      <div className="material-list">
        {materialRegistry.map((item) => (
          <MaterialCard
            key={item.type}
            type={item.type}
            label={item.label}
            description={item.description}
            onClick={() => addMaterial(item.type)}
          />
        ))}
      </div>
    </aside>
  );
}
