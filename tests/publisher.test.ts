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
    expect(chapter.last_synced_version).toBe(1);
    chapter.update("blah2");
    expect(chapter.last_synced_version).toBe(2);

    expect(Object.keys(r2).filter((x) => !x.includes(":"))).toStrictEqual([
      "story",
    ]);
    expect(Object.keys(r2).length).toBe(3);
    const mapping = JSON.parse(r2["story"]!);
    expect(mapping).toStrictEqual([["story:chapter", 0, 2]]);
  });
  test("R2 creates a key for a story with multiple chapters", () => {
    let r2: Record<string, string> = {};
    let publisher = new Publisher(r2);
    publisher.publish_chapter("story", "chapter", 0, 0, "blah");
    publisher.publish_chapter("story", "chapter 2", 0, 0, "blah");
    expect(Object.keys(r2).filter((x) => !x.includes(":"))).toStrictEqual([
      "story",
    ]);
    const mapping = JSON.parse(r2["story"]!);
    expect(mapping).toStrictEqual([
      ["story:chapter", 0, 1],
      ["story:chapter 2", 0, 1],
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
    const story1 = JSON.parse(r2["story"]!);
    const story2 = JSON.parse(r2["story 2"]!);
    expect(story1).toStrictEqual([["story:chapter", 0, 1]]);
    expect(story2).toStrictEqual([["story 2:chapter", 0, 1]]);
  });
  test("Can reload from encoded R2", () => {
    let r2: Record<string, string> = {};
    let publisher = new Publisher(r2);
    publisher.publish_chapter("story", "chapter", 0, 0, "blah");
    publisher.publish_chapter("story", "chapter 2", 0, 0, "blah");
    publisher.publish_chapter("story 2", "chapter", 0, 0, "blah");
    let publisher2 = Publisher.deserialize(r2, publisher.serialize());

    for (const [title, story] of Object.entries(publisher.stories)) {
      const story2 = publisher2.stories[title]!;
      expect(Object.keys(story2).length).toBe(Object.keys(story).length);
      for (const [chapterTitle, chapter] of Object.entries(story)) {
        const chapter2 = story2[chapterTitle]!;
        expect(chapter2.title).toBe(chapter.title);
        expect(chapter2.when_free).toBe(chapter.when_free);
        expect(chapter2.cost).toBe(chapter.cost);
        expect(chapter2.version).toBe(chapter.version);
      }
    }
    for (const story of Object.values(publisher2.stories)) {
      Object.values(story).forEach((c) =>
        expect(c.last_synced_version).toBe(c.version),
      );
    }
    expect(JSON.parse(r2["story"]!)).toStrictEqual([
      ["story:chapter", 0, 1],
      ["story:chapter 2", 0, 1],
    ]);
    expect(JSON.parse(r2["story 2"]!)).toStrictEqual([
      ["story 2:chapter", 0, 1],
    ]);
  });
  test("deserialization syncs missing versions", () => {
    let r2: Record<string, string> = {};
    let publisher = new Publisher(r2);
    const chapter = publisher.publish_chapter("story", "chapter", 0, 0, "v1");
    chapter.update("v2");
    const saved = JSON.parse(publisher.serialize());
    saved["story"][0].last_synced_version = 1;
    let r2b: Record<string, string> = {};
    const publisher2 = Publisher.deserialize(r2b, JSON.stringify(saved));
    const mapping = JSON.parse(r2b["story"]!);
    expect(mapping).toStrictEqual([["story:chapter", 0, 2]]);
    const ch2 = publisher2.stories["story"]!["chapter"]!;
    expect(ch2.last_synced_version).toBe(2);
  });
});
