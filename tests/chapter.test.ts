import { describe, expect, test } from "vitest";
import { Chapter } from "~/chapter";

describe("Chapter ", () => {
  test("contains nothing by default", () => {
    let r2: Record<string, string> = {};
    let chapter = new Chapter(r2, "chapter", 9999999999, 200);
    expect(r2[chapter.key(0)]).toBeUndefined();
  });
  test("can add text as expected", () => {
    let r2: Record<string, string> = {};
    let chapter = new Chapter(r2, "chapter", 9999999999, 200);
    expect(r2[chapter.key(0)]).toBeUndefined();
    expect(chapter.version).toBe(0);
    expect(chapter.cost).toBe(200);
    expect(chapter.title).toBe("chapter");
    chapter.update("text");
    expect(chapter.version).toBe(1);
    expect(r2[chapter.key(0)]).toBe("text");
    expect(r2[chapter.key(1)]).toBeUndefined();
  });
  test("is_free math works", () => {
    let r2: Record<string, string> = {};
    let chapter = new Chapter(r2, "chapter", 9999999999, 200);
    expect(chapter.is_free(0)).toBeFalsy();
    chapter = new Chapter(r2, "chapter", 0, 200);
    expect(chapter.is_free(0)).toBeTruthy();
  });
});
