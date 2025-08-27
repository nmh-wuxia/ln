import { describe, expect, test } from "vitest";
import { Chapter } from "~/chapter";
import { MemoryR2Bucket } from "~/r2";
import type { R2Bucket } from "~/r2";
import type { Patch } from "~/patch";

describe("Chapter", () => {
  test("constructor throws on empty text", () => {
    const r2 = new MemoryR2Bucket();
    expect(() =>
      new Chapter(r2, "story", "chapter", 9999999999, 200, ""),
    ).toThrow();
  });

  test("serialize round-trips core fields", async () => {
    const r2 = new MemoryR2Bucket();
    const chapter = new Chapter(r2, "story", "chapter", 0, 200, "# text");
    expect(chapter.last_synced_version).toBe(1);

    const saved = JSON.parse(await chapter.serialize());
    expect(saved.story_title).toBe("story");
    expect(saved.chapter_title).toBe("chapter");
    expect(saved[saved.version]).toBe("# text");

    const reloaded = await Chapter.deserialize(r2, await chapter.serialize());
    expect(reloaded.story_title).toBe("story");
    expect(reloaded.chapter_title).toBe("chapter");
    expect(await (await r2.get(reloaded.key(0)))?.text()).toBe("# text");
    expect(await (await r2.get(reloaded.key(0) + ".html"))?.text()).toBe(
      "<h1>text</h1>\n",
    );
  });

  test("is_free math works", () => {
    const r2 = new MemoryR2Bucket();
    let chapter = new Chapter(r2, "story", "chapter", 9999999999, 200, "t");
    expect(chapter.is_free(0)).toBeFalsy();
    chapter = new Chapter(r2, "story", "chapter", 0, 200, "t");
    expect(chapter.is_free(0)).toBeTruthy();
  });

  test("serialize and deserialize multiple versions", async () => {
    const r2 = new MemoryR2Bucket();
    await r2.put("story:chapter:0", "v0");
    const chapter = new Chapter(r2, "story", "chapter", 0, 0, "v1", 2);
    const serialized = await chapter.serialize();

    const r2b = new MemoryR2Bucket();
    const reloaded = await Chapter.deserialize(r2b, serialized);
    expect(await (await r2b.get(reloaded.key(0)))?.text()).toBe("v0");
    expect(await (await r2b.get(reloaded.key(0) + ".html"))?.text()).toBe("<p>v0</p>\n");
    expect(await (await r2b.get(reloaded.key(1)))?.text()).toBe("v1");
  });

  test("patch updates create conflict groups", () => {
    const r2 = new MemoryR2Bucket();
    const chapter = new Chapter(r2, "story", "chapter", 0, 0, "t");
    const a: Patch = { id: "a", start: 0, end: 2 };
    const b: Patch = { id: "b", start: 1, end: 3 };
    const c: Patch = { id: "c", start: 10, end: 12 };
    chapter.update(a);
    chapter.update(b);
    chapter.update(c);
    expect(chapter.patch_groups.length).toBe(2);
    expect(chapter.patch_groups[0]!.patches.map((p) => p.id).sort()).toEqual(["a", "b"]);
    expect(chapter.patch_groups[1]!.patches[0]!.id).toBe("c");
  });

  test("serialize handles version 0", async () => {
    const r2 = new MemoryR2Bucket();
    const chapter = new Chapter(r2, "s", "c", 0, 0, "t", 0);
    const saved = JSON.parse(await chapter.serialize());
    expect(saved.version).toBe(0);
  });

  test("deserialize fills missing optional fields", async () => {
    const r2 = new MemoryR2Bucket();
    const saved = {
      story_title: "s",
      chapter_title: "c",
      when_free: 0,
      cost: 0,
      version: 1,
      0: "# t",
      1: "# t",
    };
    const chapter = await Chapter.deserialize(r2, JSON.stringify(saved));
    expect(chapter.last_synced_version).toBe(1);
    expect(chapter.patch_groups).toEqual([]);
  });

  test("serialize throws when expected text missing", async () => {
    const r2 = new MemoryR2Bucket();
    const chapter = new Chapter(r2, "s", "c", 0, 0, "v1", 2);
    await expect(chapter.serialize()).rejects.toThrow();

    class MutableR2 implements R2Bucket {
      store = new Map<string, string>();
      async get(key: string) {
        if (!this.store.has(key)) return null;
        const value = this.store.get(key)!;
        return { text: async () => value };
      }
      async put(key: string, value: string) {
        this.store.set(key, value);
      }
      async list() {
        return { objects: [] as { key: string }[] };
      }
    }
    const r2b = new MutableR2();
    await r2b.put("s:c:0", "old");
    const chapter2 = new Chapter(r2b as any, "s", "c", 0, 0, "new", 2);
    r2b.store.delete("s:c:1");
    await expect(chapter2.serialize()).rejects.toThrow();
  });
});
