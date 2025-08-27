import { describe, expect, test } from "vitest";
import { Chapter } from "~/chapter";
import { MemoryR2Bucket } from "~/r2";
import type { Patch } from "~/patch";

describe("Chapter ", () => {
  test("constructor throws on empty text", () => {
    let r2 = new MemoryR2Bucket();
    expect(() =>
      new Chapter(r2, "story", "chapter", 9999999999, 200, ""),
    ).toThrow();
  });
  test("can add text as expected", async () => {
    let r2 = new MemoryR2Bucket();
    let chapter = new Chapter(r2, "story", "chapter", 9999999999, 200, "# text");
    expect(chapter.version).toBe(1);
    expect(chapter.cost).toBe(200);
    expect(chapter.title).toBe("story:chapter");
    expect(chapter.last_synced_version).toBe(1);
    expect(await (await r2.get(chapter.key(0)))?.text()).toBe("# text");
    expect(await (await r2.get(chapter.key(0) + ".html"))?.text()).toBe(
      "<h1>text</h1>\n",
    );
    expect(await r2.get(chapter.key(1))).toBeNull();
  });
  test("is_free math works", () => {
    let r2 = new MemoryR2Bucket();
    let chapter = new Chapter(r2, "story", "chapter", 9999999999, 200, "t");
    expect(chapter.is_free(0)).toBeFalsy();
    chapter = new Chapter(r2, "story", "chapter", 0, 200, "t");
    expect(chapter.is_free(0)).toBeTruthy();
  });
  test("serialize stores separate story and chapter titles", async () => {
    let r2 = new MemoryR2Bucket();
    let chapter = new Chapter(r2, "story", "chapter", 0, 0, "# text");
    const saved = JSON.parse(await chapter.serialize());
    expect(saved.story_title).toBe("story");
    expect(saved.chapter_title).toBe("chapter");
    expect(saved).not.toHaveProperty("title");
    expect(saved[saved.version]).toBe("# text");

    const reloaded = await Chapter.deserialize(r2, await chapter.serialize());
    expect(reloaded.story_title).toBe("story");
    expect(reloaded.chapter_title).toBe("chapter");
    expect(await (await r2.get(reloaded.key(reloaded.version - 1)))?.text()).toBe(
      "# text",
    );
    expect(
      await (
        await r2.get(reloaded.key(reloaded.version - 1) + ".html")
      )?.text(),
    ).toBe("<h1>text</h1>\n");
  });
  test("deserialize defaults last_synced_version", async () => {
    let r2 = new MemoryR2Bucket();
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
    expect(await (await r2.get(chapter.key(0)))?.text()).toBe("# t");
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
});
