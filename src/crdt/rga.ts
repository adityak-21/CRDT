export interface CharId {
    nodeId: string;
    counter: number;
}

export interface RGANode {
    id: CharId;
    char: string;
    deleted: boolean;
    parentId: CharId | null;
}
  

export interface RGAOperation {
    type: "insert" | "delete";
    node?: RGANode;
    targetId?: CharId;
    originNodeId: string;
    timestamp: number;
}
  
function compareIds(a: CharId, b: CharId): number {
    if (a.counter !== b.counter) {
        return a.counter - b.counter;
    }
    return a.nodeId > b.nodeId ? 1 : a.nodeId < b.nodeId ? -1 : 0;
}

function idsEqual(a: CharId | null, b: CharId | null): boolean {
    if (a === null && b === null) return true;
    if (a === null || b === null) return false;
    return a.nodeId === b.nodeId && a.counter === b.counter;
}

export class RGA {
    private nodes: RGANode[] = [];
    private counter: number = 0;
    private nodeId: string;
    private idIndex: Map<string, number> = new Map();

    constructor(nodeId: string) {
        this.nodeId = nodeId;
    }
    private idKey(id: CharId): string {
        return `${id.nodeId}:${id.counter}`;
    }
    private rebuildIndex(): void {
        this.idIndex.clear();
        for (let i = 0; i < this.nodes.length; i++) {
        this.idIndex.set(this.idKey(this.nodes[i].id), i);
        }
    }
    private findNodeIndex(id: CharId): number {
        const key = this.idKey(id);
        const idx = this.idIndex.get(key);
        return idx !== undefined ? idx : -1;
    }
    insertAt(position: number, char: string): RGAOperation {
        let parentId: CharId | null = null;

        if (position > 0) {
        let visibleCount = 0;
        for (const node of this.nodes) {
            if (!node.deleted) {
            visibleCount++;
            if (visibleCount === position) {
                parentId = node.id;
                break;
            }
            }
        }
        }

        this.counter++;
        const newNode: RGANode = {
        id: { nodeId: this.nodeId, counter: this.counter },
        char,
        deleted: false,
        parentId,
        };

        const op: RGAOperation = {
        type: "insert",
        node: newNode,
        originNodeId: this.nodeId,
        timestamp: Date.now(),
        };

        this.applyInsert(newNode);
        return op;
    }
    deleteAt(position: number): RGAOperation | null {
        let visibleCount = 0;
        for (const node of this.nodes) {
        if (!node.deleted) {
            if (visibleCount === position) {
            const op: RGAOperation = {
                type: "delete",
                targetId: node.id,
                originNodeId: this.nodeId,
                timestamp: Date.now(),
            };
            node.deleted = true;
            return op;
            }
            visibleCount++;
        }
        }
        return null;
    }

    private applyInsert(newNode: RGANode): void {
        if (newNode.id.counter > this.counter) {
        this.counter = newNode.id.counter;
        }

        if (this.findNodeIndex(newNode.id) !== -1) return;

        let insertIdx: number;

        if (newNode.parentId === null) {

        insertIdx = 0;
        while (insertIdx < this.nodes.length) {
            const existing = this.nodes[insertIdx];
            if (existing.parentId !== null) break;
            if (compareIds(newNode.id, existing.id) > 0) {
            break;
            }
            insertIdx++;
        }
        } else {
        const parentIdx = this.findNodeIndex(newNode.parentId);
        if (parentIdx === -1) {
            this.nodes.push(newNode);
            this.rebuildIndex();
            return;
        }

        insertIdx = parentIdx + 1;
        while (insertIdx < this.nodes.length) {
            const existing = this.nodes[insertIdx];

            if (idsEqual(existing.parentId, newNode.parentId)) {
            if (compareIds(newNode.id, existing.id) > 0) {
                break;
            }
            insertIdx++;
            } else {
            const existingParentIdx = existing.parentId
                ? this.findNodeIndex(existing.parentId)
                : -1;

            if (existingParentIdx >= parentIdx + 1 && existingParentIdx < insertIdx) {
                insertIdx++;
            } else {
                break;
            }
            }
        }
        }

        this.nodes.splice(insertIdx, 0, newNode);
        this.rebuildIndex();
    }

    apply(op: RGAOperation): void {
        if (op.type === "insert" && op.node) {
          const clonedNode: RGANode = {
            ...op.node,
            id: { ...op.node.id },
            parentId: op.node.parentId ? { ...op.node.parentId } : null,
          };
          this.applyInsert(clonedNode);
        } else if (op.type === "delete" && op.targetId) {
          const idx = this.findNodeIndex(op.targetId);
          if (idx !== -1) {
            this.nodes[idx].deleted = true;
          }
        }
      }

    toString(): string {
        return this.nodes
        .filter((n) => !n.deleted)
        .map((n) => n.char)
        .join("");
    }

    get length(): number {
        return this.nodes.filter((n) => !n.deleted).length;
    }

    getAllNodes(): RGANode[] {
        return [...this.nodes];
    }

    charAt(position: number): string {
        let visibleCount = 0;
        for (const node of this.nodes) {
        if (!node.deleted) {
            if (visibleCount === position) return node.char;
            visibleCount++;
        }
        }
        return "";
    }

    visiblePositionToNodeIndex(position: number): number {
        let visibleCount = 0;
        for (let i = 0; i < this.nodes.length; i++) {
        if (!this.nodes[i].deleted) {
            if (visibleCount === position) return i;
            visibleCount++;
        }
        }
        return -1;
    }

    merge(other: RGA): void {
        for (const node of other.nodes) {
        if (this.findNodeIndex(node.id) === -1) {
            this.applyInsert({ ...node, deleted: false });
        }
        // Apply tombstones
        if (node.deleted) {
            const idx = this.findNodeIndex(node.id);
            if (idx !== -1) {
            this.nodes[idx].deleted = true;
            }
        }
        }
    }

    exportOperations(): RGAOperation[] {
        return this.nodes.map((node) => ({
        type: node.deleted ? ("delete" as const) : ("insert" as const),
        node: { ...node, deleted: false },
        targetId: node.deleted ? node.id : undefined,
        originNodeId: node.id.nodeId,
        timestamp: 0,
        }));
    }
}