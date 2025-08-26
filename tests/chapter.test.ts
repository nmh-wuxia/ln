import { describe, expect, test } from "vitest";
import { Chapter } from "~/chapter";

describe("Chapter ", () => {
  test("contains nothing by default", () => {
    let chapter = new Chapter({}, "chapter", 9999999999, 200);
    expect(chapter.text(0)).toBeUndefined();
  });
  test("can add text as expected", () => {
    let chapter = new Chapter({}, "chapter", 9999999999, 200);
    expect(chapter.text(0)).toBeUndefined();
    expect(chapter.version).toBe(0);
    expect(chapter.cost).toBe(200);
    expect(chapter.name).toBe("chapter");
    chapter.update("text");
    expect(chapter.version).toBe(1);
    expect(chapter.text(0)).toBe("text");
    expect(chapter.text(1)).toBeUndefined();
  });
  test("is_free math works", () => {
    let chapter = new Chapter({}, "chapter", 9999999999, 200);
    expect(chapter.is_free(0)).toBeFalsy();
    chapter = new Chapter({}, "chapter", 0, 200);
    expect(chapter.is_free(0)).toBeTruthy();
  });
});
