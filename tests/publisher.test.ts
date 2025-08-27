import { describe, expect, test, vi } from "vitest";
import { Chapter } from "~/chapter";
import { Publisher } from "~/publisher";
import { MemoryR2Bucket } from "~/r2";

describe("Publisher", () => {
  test("R2 is empty by construction", async () => {
    let r2 = new MemoryR2Bucket();
    let publisher = new Publisher(r2);
    expect((await r2.list()).objects.length).toBe(0);
  });
  test("R2 creates a key for a story", async () => {
    let r2 = new MemoryR2Bucket();
    let publisher = new Publisher(r2);
    await publisher.publish_chapter("story", "chapter", 0, 0, "blah");

    const keys = (await r2.list()).objects
      .filter((x) => !x.key.includes(":"))
      .map((x) => x.key);
    expect(keys).toStrictEqual(["story"]);
  });
  test("publishing empty text throws", async () => {
    let r2 = new MemoryR2Bucket();
    let publisher = new Publisher(r2);
    await expect(
      publisher.publish_chapter("story", "chapter", 0, 0, ""),
    ).rejects.toThrow();
  });
  test("update_story_map does nothing for missing story", async () => {
    let r2 = new MemoryR2Bucket();
    let publisher = new Publisher(r2);
    await publisher.update_story_map("ghost", "ch", 0, 0);
    expect((await r2.list()).objects.length).toBe(0);
  });
  test("R2 handles story update", async () => {
    let r2 = new MemoryR2Bucket();
    let publisher = new Publisher(r2);
    const chapter = await publisher.publish_chapter(
      "story",
      "chapter",
      0,
      0,
      "blah",
    );
    expect(chapter.last_synced_version).toBe(1);

    const keys = (await r2.list()).objects.map((o) => o.key);
    expect(keys.filter((x) => !x.includes(":"))).toStrictEqual(["story"]);
    expect(keys.length).toBe(3);
    expect(await (await r2.get("story:chapter:0.html"))?.text()).toBe(
      "<p>blah</p>\n",
    );
    const mapping = JSON.parse(
      await (await r2.get("story"))!.text(),
    );
    expect(mapping).toStrictEqual([["story:chapter", 0, 1]]);
  });
  test("R2 creates a key for a story with multiple chapters", async () => {
    let r2 = new MemoryR2Bucket();
    let publisher = new Publisher(r2);
    await publisher.publish_chapter("story", "chapter", 0, 0, "blah");
    await publisher.publish_chapter("story", "chapter 2", 0, 0, "blah");
    const keys = (await r2.list()).objects
      .filter((x) => !x.key.includes(":"))
      .map((x) => x.key);
    expect(keys).toStrictEqual(["story"]);
    const mapping = JSON.parse(
      await (await r2.get("story"))!.text(),
    );
    expect(mapping).toStrictEqual([
      ["story:chapter", 0, 1],
      ["story:chapter 2", 0, 1],
    ]);
  });
  test("R2 creates a keys for two stories", async () => {
    let r2 = new MemoryR2Bucket();
    let publisher = new Publisher(r2);
    await publisher.publish_chapter("story", "chapter", 0, 0, "blah");
    await publisher.publish_chapter("story 2", "chapter", 0, 0, "blah");
    const keys = (await r2.list()).objects
      .filter((x) => !x.key.includes(":"))
      .map((x) => x.key)
      .sort();
    expect(keys).toStrictEqual(["story", "story 2"]);
    const story1 = JSON.parse(await (await r2.get("story"))!.text());
    const story2 = JSON.parse(await (await r2.get("story 2"))!.text());
    expect(story1).toStrictEqual([["story:chapter", 0, 1]]);
    expect(story2).toStrictEqual([["story 2:chapter", 0, 1]]);
  });
  test("Can reload from encoded R2", async () => {
    let r2 = new MemoryR2Bucket();
    let publisher = new Publisher(r2);
    await publisher.publish_chapter("story", "chapter", 0, 0, "blah");
    await publisher.publish_chapter("story", "chapter 2", 0, 0, "blah");
    await publisher.publish_chapter("story 2", "chapter", 0, 0, "blah");
    let publisher2 = await Publisher.deserialize(r2, await publisher.serialize());

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
    expect(JSON.parse(await (await r2.get("story"))!.text())).toStrictEqual([
      ["story:chapter", 0, 1],
      ["story:chapter 2", 0, 1],
    ]);
    expect(JSON.parse(await (await r2.get("story 2"))!.text())).toStrictEqual([
      ["story 2:chapter", 0, 1],
    ]);
  });
});
