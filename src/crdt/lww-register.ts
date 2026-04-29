export class LWWRegister<T> {
    private _value: T | null = null;
    private _timestamp = 0;
    private _nodeId: string;
  
    constructor(nodeId: string) {
      this._nodeId = nodeId;
    }

    set(value: T, timestamp?: number): void {
      this._timestamp = timestamp ?? Date.now();
      this._value = value;
    }
  

    get(): T | null {
      return this._value;
    }
  

    merge(other: LWWRegister<T>): void {
      if (other._timestamp > this._timestamp) {
        this._value = other._value;
        this._timestamp = other._timestamp;
      } else if (other._timestamp === this._timestamp) {
        if (other._nodeId > this._nodeId) {
          this._value = other._value;
          this._timestamp = other._timestamp;
        }
      }
    }

    state(): { value: T | null; timestamp: number; nodeId: string } {
      return {
        value: this._value,
        timestamp: this._timestamp,
        nodeId: this._nodeId,
      };
    }

    static fromState<T>(
      nodeId: string,
      state: { value: T | null; timestamp: number; nodeId: string }
    ): LWWRegister<T> {
      const reg = new LWWRegister<T>(nodeId);
      reg._value = state.value;
      reg._timestamp = state.timestamp;
      return reg;
    }
  }