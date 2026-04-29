type UniqueTag = string;

function generateTag(): UniqueTag {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export class ORSet<T> {
  private elements: Map<string, Set<UniqueTag>> = new Map();

  private tombstones: Set<UniqueTag> = new Set();

  private nodeId: string;

  constructor(nodeId: string) {
    this.nodeId = nodeId;
  }

  private key(element: T): string {
    return JSON.stringify(element);
  }

  add(element: T): void {
    const k = this.key(element);
    if (!this.elements.has(k)) {
      this.elements.set(k, new Set());
    }
    this.elements.get(k)!.add(generateTag());
  }


  remove(element: T): void {
    const k = this.key(element);
    const tags = this.elements.get(k);
    if (tags) {
      for (const tag of tags) {
        this.tombstones.add(tag);
      }
      this.elements.delete(k);
    }
  }

  has(element: T): boolean {
    const k = this.key(element);
    const tags = this.elements.get(k);
    return !!tags && tags.size > 0;
  }

  values(): T[] {
    const result: T[] = [];
    for (const [k, tags] of this.elements) {
      if (tags.size > 0) {
        result.push(JSON.parse(k));
      }
    }
    return result;
  }

  merge(other: ORSet<T>): void {
    for (const [k, otherTags] of other.elements) {
      if (!this.elements.has(k)) {
        this.elements.set(k, new Set());
      }
      const myTags = this.elements.get(k)!;
      for (const tag of otherTags) {
        if (!this.tombstones.has(tag)) {
          myTags.add(tag);
        }
      }
    }

    for (const [k, myTags] of this.elements) {
      for (const tag of myTags) {
        if (other.tombstones.has(tag)) {
          myTags.delete(tag);
          this.tombstones.add(tag);
        }
      }
      if (myTags.size === 0) {
        this.elements.delete(k);
      }
    }

    for (const tag of other.tombstones) {
      this.tombstones.add(tag);
    }
  }

  state(): { elements: Record<string, string[]>; tombstones: string[] } {
    const elements: Record<string, string[]> = {};
    for (const [k, tags] of this.elements) {
      elements[k] = Array.from(tags);
    }
    return {
      elements,
      tombstones: Array.from(this.tombstones),
    };
  }

  static fromState<T>(
    nodeId: string,
    state: { elements: Record<string, string[]>; tombstones: string[] }
  ): ORSet<T> {
    const set = new ORSet<T>(nodeId);
    for (const [k, tags] of Object.entries(state.elements)) {
      set.elements.set(k, new Set(tags));
    }
    set.tombstones = new Set(state.tombstones);
    return set;
  }
}