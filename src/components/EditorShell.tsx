import { DndContext, DragOverlay, PointerSensor, pointerWithin, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from '@dnd-kit/core';
import { useMemo, useState } from 'react';
import { Canvas } from './Canvas';
import { LayerPanel } from './LayerPanel';
import { MaterialPanel } from './MaterialPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { TemplatePanel } from './TemplatePanel';
import { Topbar } from './Topbar';
import { useEditorStore } from '../store/editorStore';
import { materialRegistry } from '../materials/registry';
import { findNode } from '../utils/tree';
import type { DragData, DropSlotData } from '../utils/dnd';

export function EditorShell() {
  const mode = useEditorStore((state) => state.mode);
  const schema = useEditorStore((state) => state.schema);
  const insertMaterial = useEditorStore((state) => state.insertMaterial);
  const moveNodeByDrop = useEditorStore((state) => state.moveNodeByDrop);
  const isPreview = mode === 'preview';
  const [activeDrag, setActiveDrag] = useState<DragData | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
  );

  const overlayLabel = useMemo(() => {
    if (!activeDrag) return '';

    if (activeDrag.kind === 'material') {
      return materialRegistry.find((item) => item.type === activeDrag.materialType)?.label ?? activeDrag.materialType;
    }

    return findNode(schema.nodes, activeDrag.nodeId)?.name ?? '节点';
  }, [activeDrag, schema.nodes]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDrag((event.active.data.current as DragData | undefined) ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const active = event.active.data.current as DragData | undefined;
    const over = event.over?.data.current as DropSlotData | undefined;

    if (!active || !over) {
      setActiveDrag(null);
      return;
    }

    if (active.kind === 'material') {
      insertMaterial(active.materialType, over.parentId, over.index);
    } else {
      moveNodeByDrop(active.nodeId, over.parentId, over.index);
    }

    setActiveDrag(null);
  };

  const handleDragCancel = () => {
    setActiveDrag(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="editor-shell">
        <Topbar />

        <div className={`workspace ${isPreview ? 'preview-layout' : ''}`}>
          {!isPreview ? (
            <div className="left-sticky-column">
              <TemplatePanel />
              <MaterialPanel />
            </div>
          ) : null}

          <Canvas />

          {!isPreview ? (
            <div className="right-sticky-column">
              <LayerPanel />
              <PropertiesPanel />
            </div>
          ) : null}
        </div>
      </div>

      <DragOverlay>
        {activeDrag ? <div className="drag-overlay-card">{overlayLabel}</div> : null}
      </DragOverlay>
    </DndContext>
  );
}
