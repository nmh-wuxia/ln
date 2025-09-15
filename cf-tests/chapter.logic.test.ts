import { describe, it, expect } from "vitest";
import DiffMatchPatch from "diff-match-patch";
import { ChapterDO } from "~/do/chapter";

class MockSql {
  row: any = null;
  exec(query: string, ...params: any[]) {
    if (query.startsWith("CREATE TABLE")) return { rowsWritten: 0 };
    if (query.startsWith("SELECT story_title")) {
      return { toArray: () => (this.row ? [this.row] : []) };
    }
    if (query.startsWith("SELECT 1 as one")) {
      return { toArray: () => (this.row ? [{ one: 1 }] : []) };
    }
    if (query.startsWith("INSERT INTO chapter_meta")) {
      this.row = {
        story_title: params[0],
        chapter_title: params[1],
        when_free: params[2],
        cost: params[3],
        version: params[4],
        last_synced_version: params[5],
        patch_groups: params[6],
      };
      return { rowsWritten: 1 };
    }
    if (query.startsWith("UPDATE chapter_meta")) {
      if (!this.row) return { rowsWritten: 0 };
      this.row = {
        story_title: params[0],
        chapter_title: params[1],
        when_free: params[2],
        cost: params[3],
        version: params[4],
        last_synced_version: params[5],
        patch_groups: params[6],
      };
      return { rowsWritten: 1 };
    }
    if (query.startsWith("DELETE FROM chapter_meta")) {
      this.row = null;
      return { rowsWritten: 1 };
    }
    return { rowsWritten: 1 };
  }
}

class MockState {
  storage = { sql: new MockSql() };
  blockConcurrencyWhile = async (fn: any) => fn();
}

class MockBucket {
  store = new Map<string, string>();
  async put(key: string, value: string) {
    this.store.set(key, value.toString());
  }
  async get(key: string) {
    if (!this.store.has(key)) return null;
    const val = this.store.get(key)!;
    return { text: async () => val } as any;
  }
}

function makeDO() {
  const state = new MockState();
  const env = { BUCKET: new MockBucket() } as any;
  return new ChapterDO(state as any, env);
}

describe("ChapterDO direct", () => {
  it("initializes and retrieves text", async () => {
    const doObj = makeDO();
    const res = await doObj.init({
      story_title: "story",
      chapter_title: "chapter",
      text: "Hello",
    });
    expect(res).toEqual({ ok: true, title: "story:chapter", version: 1 });
    const text = await doObj.text();
    expect(text).toBe("Hello");
  });

  it("applies patches and bumps version", async () => {
    const doObj = makeDO();
    await doObj.init({ story_title: "s", chapter_title: "c", text: "Hello" });
    const dmp = new DiffMatchPatch();
    const patch = dmp.patch_toText(dmp.patch_make("Hello", "Hello world"));
    const { id } = await doObj.add_patch({ start: 5, end: 5, patch });
    const res = await doObj.apply_patch({ id });
    expect(res).toEqual({ ok: true, version: 2 });
    const text = await doObj.text();
    expect(text).toBe("Hello world");
  });

  it("returns error on invalid version", async () => {
    const doObj = makeDO();
    await doObj.init({ story_title: "s", chapter_title: "c2", text: "Hi" });
    const res = await doObj.text({ version: 99 });
    expect(res).toEqual({ error: "invalid version" });
  });
});
