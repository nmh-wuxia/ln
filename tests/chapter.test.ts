import { describe, expect, test } from "vitest";
import { Chapter } from "~/chapter";
import { MemoryR2Bucket } from "~/r2";

describe("Chapter ", () => {
  test("contains nothing by default", async () => {
    let r2 = new MemoryR2Bucket();
    let chapter = new Chapter(r2, "story", "chapter", 9999999999, 200);
    expect(await r2.get(chapter.key(0))).toBeNull();
  });
  test("can add text as expected", async () => {
    let r2 = new MemoryR2Bucket();
    let chapter = new Chapter(r2, "story", "chapter", 9999999999, 200);
    expect(await r2.get(chapter.key(0))).toBeNull();
    expect(chapter.version).toBe(0);
    expect(chapter.cost).toBe(200);
    expect(chapter.title).toBe("story:chapter");
    expect(chapter.last_synced_version).toBe(0);
    await chapter.update("# text");
    expect(chapter.version).toBe(1);
    expect(chapter.last_synced_version).toBe(1);
    expect(await (await r2.get(chapter.key(0)))?.text()).toBe("# text");
    expect(await (await r2.get(chapter.key(0) + ".html"))?.text()).toBe(
      "<h1>text</h1>\n",
    );
    expect(await r2.get(chapter.key(1))).toBeNull();
  });
  test("is_free math works", () => {
    let r2 = new MemoryR2Bucket();
    let chapter = new Chapter(r2, "story", "chapter", 9999999999, 200);
    expect(chapter.is_free(0)).toBeFalsy();
    chapter = new Chapter(r2, "story", "chapter", 0, 200);
    expect(chapter.is_free(0)).toBeTruthy();
  });
  test("serialize stores separate story and chapter titles", async () => {
    let r2 = new MemoryR2Bucket();
    let chapter = new Chapter(r2, "story", "chapter", 0, 0);
    await chapter.update("# text");
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
});
