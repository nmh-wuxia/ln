import { describe, expect, test } from "vitest";
import { Chapter } from "~/chapter";

describe("Chapter ", () => {
  test("contains nothing by default", () => {
    let r2: Record<string, string> = {};
    let chapter = new Chapter(r2, "story", "chapter", 9999999999, 200);
    expect(r2[chapter.key(0)]).toBeUndefined();
  });
  test("can add text as expected", () => {
    let r2: Record<string, string> = {};
    let chapter = new Chapter(r2, "story", "chapter", 9999999999, 200);
    expect(r2[chapter.key(0)]).toBeUndefined();
    expect(chapter.version).toBe(0);
    expect(chapter.cost).toBe(200);
    expect(chapter.title).toBe("story:chapter");
    expect(chapter.last_synced_version).toBe(0);
    chapter.update("text");
    expect(chapter.version).toBe(1);
    expect(chapter.last_synced_version).toBe(1);
    expect(r2[chapter.key(0)]).toBe("text");
    expect(r2[chapter.key(1)]).toBeUndefined();
  });
  test("is_free math works", () => {
    let r2: Record<string, string> = {};
    let chapter = new Chapter(r2, "story", "chapter", 9999999999, 200);
    expect(chapter.is_free(0)).toBeFalsy();
    chapter = new Chapter(r2, "story", "chapter", 0, 200);
    expect(chapter.is_free(0)).toBeTruthy();
  });
  test("serialize stores separate story and chapter titles", () => {
    let r2: Record<string, string> = {};
    let chapter = new Chapter(r2, "story", "chapter", 0, 0);
    chapter.update("text");
    const saved = JSON.parse(chapter.serialize());
    expect(saved.story_title).toBe("story");
    expect(saved.chapter_title).toBe("chapter");
    expect(saved).not.toHaveProperty("title");
    expect(saved[saved.version]).toBe("text");

    const reloaded = Chapter.deserialize(r2, chapter.serialize());
    expect(reloaded.story_title).toBe("story");
    expect(reloaded.chapter_title).toBe("chapter");
    expect(r2[reloaded.key(reloaded.version - 1)]).toBe("text");
  });
});
