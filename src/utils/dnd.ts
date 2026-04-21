import type { MaterialType } from '../types/schema';

export type DragData =
  | {
      kind: 'material';
      materialType: MaterialType;
    }
  | {
      kind: 'node';
      nodeId: string;
    };

export interface DropSlotData {
  parentId: string | null;
  index: number;
  position: 'before' | 'after' | 'inside' | 'root';
}

export function createDropSlotId(parentId: string | null, index: number, position: DropSlotData['position']) {
  return `drop:${parentId ?? 'root'}:${position}:${index}`;
}
