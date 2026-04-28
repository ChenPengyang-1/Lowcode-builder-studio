import type { PageNode } from '../types/schema';

// 这一组树操作工具函数，是编辑器增删改查和拖拽重排的底层基础。
export function findNode(nodes: PageNode[], id: string): PageNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    if (node.children?.length) {
      const target = findNode(node.children, id);
      if (target) return target;
    }
  }
  return null;
}

export function updateNode(
  nodes: PageNode[],
  id: string,
  updater: (node: PageNode) => PageNode,
): PageNode[] {
  return nodes.map((node) => {
    if (node.id === id) return updater(node);
    if (node.children?.length) {
      return {
        ...node,
        children: updateNode(node.children, id, updater),
      };
    }
    return node;
  });
}

export function deleteNode(nodes: PageNode[], id: string): PageNode[] {
  return nodes
    .filter((node) => node.id !== id)
    .map((node) => ({
      ...node,
      children: node.children ? deleteNode(node.children, id) : undefined,
    }));
}

// 拍平后的节点结果，适合图层面板和统计面板这类线性展示场景。
export function flattenNodes(nodes: PageNode[], depth = 0): Array<PageNode & { depth: number }> {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...(node.children ? flattenNodes(node.children, depth + 1) : []),
  ]);
}

// 图层面板这类线性 UI 会使用拍平后的节点列表，而真正的编辑仍然基于树结构进行。
export function moveNodeIndex(nodes: PageNode[], id: string, direction: 'up' | 'down'): PageNode[] {
  const index = nodes.findIndex((node) => node.id === id);
  if (index !== -1) {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= nodes.length) return nodes;
    const next = [...nodes];
    [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
    return next;
  }

  return nodes.map((node) => {
    if (!node.children?.length) return node;
    return {
      ...node,
      children: moveNodeIndex(node.children, id, direction),
    };
  });
}

export function insertNode(
  nodes: PageNode[],
  newNode: PageNode,
  parentId: string | null = null,
  index?: number,
): PageNode[] {
  // parentId 为空时，表示把节点直接插入页面根层级。
  if (!parentId) {
    const next = [...nodes];
    const insertionIndex = typeof index === 'number' ? Math.max(0, Math.min(index, next.length)) : next.length;
    next.splice(insertionIndex, 0, newNode);
    return next;
  }

  return nodes.map((node) => {
    if (node.id === parentId) {
      // 只替换命中的这一支 children，避免整棵树无意义重建。
      const children = [...(node.children ?? [])];
      const insertionIndex = typeof index === 'number' ? Math.max(0, Math.min(index, children.length)) : children.length;
      children.splice(insertionIndex, 0, newNode);
      return { ...node, children };
    }
    if (!node.children?.length) return node;
    return {
      ...node,
      children: insertNode(node.children, newNode, parentId, index),
    };
  });
}

export function duplicateNodeAtSelection(nodes: PageNode[], id: string, duplicate: PageNode): PageNode[] {
  const index = nodes.findIndex((node) => node.id === id);
  if (index !== -1) {
    const next = [...nodes];
    next.splice(index + 1, 0, duplicate);
    return next;
  }

  return nodes.map((node) => {
    if (!node.children?.length) return node;
    return {
      ...node,
      children: duplicateNodeAtSelection(node.children, id, duplicate),
    };
  });
}

export function deepCloneNode<T>(node: T): T {
  return JSON.parse(JSON.stringify(node));
}

function removeNodeWithMeta(
  nodes: PageNode[],
  id: string,
  parentId: string | null = null,
): { nodes: PageNode[]; removed: PageNode | null; sourceParentId: string | null; sourceIndex: number } {
  const index = nodes.findIndex((node) => node.id === id);
  if (index !== -1) {
    const next = [...nodes];
    const [removed] = next.splice(index, 1);
    return { nodes: next, removed, sourceParentId: parentId, sourceIndex: index };
  }

  for (const node of nodes) {
    if (node.children?.length) {
      const result = removeNodeWithMeta(node.children, id, node.id);
      if (result.removed) {
        return {
          nodes: nodes.map((item) =>
            item.id === node.id
              ? {
                  ...item,
                  children: result.nodes,
                }
              : item,
          ),
          removed: result.removed,
          sourceParentId: result.sourceParentId,
          sourceIndex: result.sourceIndex,
        };
      }
    }
  }

  return { nodes, removed: null, sourceParentId: null, sourceIndex: -1 };
}

// 阻止把节点拖进自己或自己的子孙节点里，避免树结构出现循环。
function isDescendantOrSelf(nodes: PageNode[], sourceId: string, maybeParentId: string | null): boolean {
  if (!maybeParentId) return false;
  if (sourceId === maybeParentId) return true;
  const sourceNode = findNode(nodes, sourceId);
  if (!sourceNode) return false;
  return !!findNode(sourceNode.children ?? [], maybeParentId);
}

export function moveNodeTo(
  nodes: PageNode[],
  sourceId: string,
  targetParentId: string | null,
  targetIndex?: number,
): PageNode[] {
  if (isDescendantOrSelf(nodes, sourceId, targetParentId)) return nodes;

  // 跨层级拖拽的本质是先把节点从旧位置摘下来，再插回目标位置。
  const extracted = removeNodeWithMeta(nodes, sourceId);
  if (!extracted.removed) return nodes;

  let insertionIndex = typeof targetIndex === 'number' ? targetIndex : undefined;
  if (
    extracted.sourceParentId === targetParentId &&
    typeof insertionIndex === 'number' &&
    extracted.sourceIndex < insertionIndex
  ) {
    insertionIndex -= 1;
  }

  return insertNode(extracted.nodes, extracted.removed, targetParentId, insertionIndex);
}
