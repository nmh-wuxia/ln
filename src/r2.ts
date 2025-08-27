export interface R2Object {
  text(): Promise<string>;
}

export interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
  put(key: string, value: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{ objects: { key: string }[] }>;
}

export class MemoryR2Bucket implements R2Bucket {
  private store: Map<string, string>;

  constructor(initial: Record<string, string> = {}) {
    this.store = new Map(Object.entries(initial));
  }

  async get(key: string): Promise<R2Object | null> {
    if (!this.store.has(key)) return null;
    const value = this.store.get(key)!;
    return {
      text: async () => value,
    };
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async list(options?: { prefix?: string }): Promise<{ objects: { key: string }[] }> {
    const objects: { key: string }[] = [];
    for (const key of this.store.keys()) {
      if (options?.prefix && !key.startsWith(options.prefix)) continue;
      objects.push({ key });
    }
    return { objects };
  }
}
