import { describe, expect, test, vi } from "vitest";
import { Chapter } from "~/chapter";
import { Publisher } from "~/publisher";

describe("Publisher", () => {
  test("R2 is empty by construction", () => {
    let r2: Record<string, string> = {};
    let publisher = new Publisher(r2);
    expect(Object.keys(r2).length).toBe(0);
  });
  test("R2 creates a key for a story", () => {
    let r2: Record<string, string> = {};
    let publisher = new Publisher(r2);
    publisher.publish_chapter("story", "chapter", 0, 0, "blah");

    expect(Object.keys(r2).filter((x) => !x.includes(":"))).toStrictEqual([
      "story",
    ]);
  });
  test("R2 handles story update", () => {
    let r2: Record<string, string> = {};
    let publisher = new Publisher(r2);
    const chapter = publisher.publish_chapter("story", "chapter", 0, 0, "blah");
    chapter.update("blah2");

    expect(Object.keys(r2).filter((x) => !x.includes(":"))).toStrictEqual([
      "story",
    ]);
    expect(Object.keys(r2).length).toBe(3);
  });
  test("R2 creates a key for a story with multiple chapters", () => {
    let r2: Record<string, string> = {};
    let publisher = new Publisher(r2);
    publisher.publish_chapter("story", "chapter", 0, 0, "blah");
    publisher.publish_chapter("story", "chapter 2", 0, 0, "blah");
    expect(Object.keys(r2).filter((x) => !x.includes(":"))).toStrictEqual([
      "story",
    ]);
  });
  test("R2 creates a keys for two stories", () => {
    let r2: Record<string, string> = {};
    let publisher = new Publisher(r2);
    publisher.publish_chapter("story", "chapter", 0, 0, "blah");
    publisher.publish_chapter("story 2", "chapter", 0, 0, "blah");
    expect(
      Object.keys(r2)
        .filter((x) => !x.includes(":"))
        .sort(),
    ).toStrictEqual(["story", "story 2"]);
  });
  test("Can reload from encoded R2", () => {
    let r2: Record<string, string> = {};
    let publisher = new Publisher(r2);
    publisher.publish_chapter("story", "chapter", 0, 0, "blah");
    publisher.publish_chapter("story", "chapter 2", 0, 0, "blah");
    publisher.publish_chapter("story 2", "chapter", 0, 0, "blah");
    let publisher2 = Publisher.deserialize(r2, publisher.serialize());

    expect(publisher.stories).toStrictEqual(publisher2.stories);
  });
});
