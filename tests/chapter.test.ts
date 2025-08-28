import { describe, expect, test } from "vitest";
import { Chapter } from "~/chapter";
import { MemoryR2Bucket } from "~/r2";
import type { R2Bucket } from "~/r2";
import type { Patch } from "~/patch";

describe("Chapter", () => {
  describe("validation", () => {
    test("constructor throws on empty text", () => {
      const r2 = new MemoryR2Bucket();
      expect(
        () => new Chapter(r2, "story", "chapter", 9999999999, 200, ""),
      ).toThrow();
    });
  });
  describe("serialization", () => {
    test("serializes core fields", async () => {
      const bucketA = new MemoryR2Bucket();
      const chapterA = new Chapter(
        bucketA,
        "storyA",
        "chapterA",
        0,
        200,
        "# text",
      );
      expect(chapterA.last_synced_version).toBe(1);

      const savedA = JSON.parse(await chapterA.serialize());
      expect(savedA.story_title).toBe("storyA");
      expect(savedA.chapter_title).toBe("chapterA");
      expect(savedA[savedA.version]).toBe("# text");

      const reloadedA = await Chapter.deserialize(
        bucketA,
        await chapterA.serialize(),
      );
      expect(reloadedA.story_title).toBe("storyA");
      expect(reloadedA.chapter_title).toBe("chapterA");
      expect(await (await bucketA.get(reloadedA.key(0)))?.text()).toBe(
        "# text",
      );
      expect(
        await (await bucketA.get(reloadedA.key(0) + ".html"))?.text(),
      ).toBe("<h1>text</h1>\n");
    });
    test("multi-version round-trip", async () => {
      // Multi-version round-trip within same test
      const bucketB = new MemoryR2Bucket();
      await bucketB.put("storyB:chapterB:0", "v0");
      const chapterB = new Chapter(
        bucketB,
        "storyB",
        "chapterB",
        0,
        0,
        "v1",
        2,
      );
      const serializedB = await chapterB.serialize();

      const bucketC = new MemoryR2Bucket();
      const reloadedB = await Chapter.deserialize(bucketC, serializedB);
      expect(await (await bucketC.get(reloadedB.key(0)))?.text()).toBe("v0");
      expect(
        await (await bucketC.get(reloadedB.key(0) + ".html"))?.text(),
      ).toBe("<p>v0</p>\n");
      expect(await (await bucketC.get(reloadedB.key(1)))?.text()).toBe("v1");
    });
    test("serialize handles version 0", async () => {
      const bucket = new MemoryR2Bucket();
      const chapter = new Chapter(bucket, "s", "c", 0, 0, "t", 0);
      const saved = JSON.parse(await chapter.serialize());
      expect(saved.version).toBe(0);
    });
    test("deserialize fills missing optional fields", async () => {
      const bucket = new MemoryR2Bucket();
      const saved = {
        story_title: "s",
        chapter_title: "c",
        when_free: 0,
        cost: 0,
        version: 1,
        0: "# t",
        1: "# t",
      };
      const chapter = await Chapter.deserialize(bucket, JSON.stringify(saved));
      expect(chapter.last_synced_version).toBe(1);
      expect(chapter.patch_groups).toEqual([]);
    });
    test("serialize throws when expected text missing", async () => {
      const bucket = new MemoryR2Bucket();
      const chapter = new Chapter(bucket, "s", "c", 0, 0, "v1", 2);
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
      const bucket2 = new MutableR2();
      await bucket2.put("s:c:0", "old");
      const chapter2 = new Chapter(bucket2 as any, "s", "c", 0, 0, "new", 2);
      bucket2.store.delete("s:c:1");
      await expect(chapter2.serialize()).rejects.toThrow();
    });
  });
  // is_free behavior is exercised via user ownership tests.
  describe("patching", () => {
    test("patch updates create conflict groups", () => {
      const bucket = new MemoryR2Bucket();
      const chapter = new Chapter(bucket, "story", "chapter", 0, 0, "t");
      const a: Patch = { id: "a", start: 0, end: 2 };
      const b: Patch = { id: "b", start: 1, end: 3 };
      const c: Patch = { id: "c", start: 10, end: 12 };
      chapter.update(a);
      chapter.update(b);
      chapter.update(c);
      expect(chapter.patch_groups.length).toBe(2);
      expect(chapter.patch_groups[0]!.patches.map((p) => p.id).sort()).toEqual([
        "a",
        "b",
      ]);
      expect(chapter.patch_groups[1]!.patches[0]!.id).toBe("c");
    });
  });
});
