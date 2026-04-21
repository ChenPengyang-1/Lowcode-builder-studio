import { useDroppable, useDndContext } from '@dnd-kit/core';
import { createDropSlotId } from '../utils/dnd';

interface DropSlotProps {
  parentId: string | null;
  index: number;
  position: 'before' | 'after' | 'inside' | 'root';
  label: string;
  className?: string;
}

export function DropSlot({ parentId, index, position, label, className = '' }: DropSlotProps) {
  const { active } = useDndContext();
  const { isOver, setNodeRef } = useDroppable({
    id: createDropSlotId(parentId, index, position),
    data: {
      parentId,
      index,
      position,
    },
  });

  const visible = Boolean(active);

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${visible ? 'visible' : ''} ${isOver ? 'active' : ''}`.trim()}
      title={label}
    >
      <span>{label}</span>
    </div>
  );
}
