import { describe, expect, test, vi } from "vitest";
import { Chapter } from "~/chapter";
import { Publisher } from "~/publisher";
import { MemoryR2Bucket } from "~/r2";
import type {
  Translator,
  ChapterTranslationInput,
  ChapterTranslationOutput,
} from "~/translator";

describe("Publisher", () => {
  describe("mapping", () => {
    test("update_story_map does nothing for missing story", async () => {
      // No story has been published yet; update should be a no-op.
      const bucket = new MemoryR2Bucket();
      const publisher = new Publisher(bucket);
      await publisher.update_story_map("ghost", "ch", 0, 0);
      expect((await bucket.list()).objects.length).toBe(0);
    });
    test("creates and updates story mappings across stories", async () => {
      const bucket = new MemoryR2Bucket();
      const publisher = new Publisher(bucket);

      // First chapter in first story
      const ch1 = await publisher.publish_chapter(
        "story",
        "chapter",
        0,
        0,
        "blah",
      );
      expect(ch1.last_synced_version).toBe(1);
      expect(await (await bucket.get("story:chapter:0.html"))?.text()).toBe(
        "<p>blah</p>\n",
      );
      expect(
        JSON.parse(await (await bucket.get("story"))!.text()),
      ).toStrictEqual([["story:chapter", 0, 1]]);

      // Second chapter in same story updates mapping
      await publisher.publish_chapter("story", "chapter 2", 0, 0, "blah");
      expect(
        JSON.parse(await (await bucket.get("story"))!.text()),
      ).toStrictEqual([
        ["story:chapter", 0, 1],
        ["story:chapter 2", 0, 1],
      ]);

      // Chapter in second story yields separate mapping key
      await publisher.publish_chapter("story 2", "chapter", 0, 0, "blah");
      const storyKeys = (await bucket.list()).objects
        .filter((x) => !x.key.includes(":"))
        .map((x) => x.key)
        .sort();
      expect(storyKeys).toStrictEqual(["story", "story 2"]);
      expect(
        JSON.parse(await (await bucket.get("story 2"))!.text()),
      ).toStrictEqual([["story 2:chapter", 0, 1]]);
    });
  });
  describe("translator", () => {
    test("Publisher uses translator before creating chapter", async () => {
      // Translator adapts the titles and text before persistence.
      class SuffixTranslator implements Translator {
        async translate(
          input: ChapterTranslationInput,
        ): Promise<ChapterTranslationOutput> {
          return {
            story_title: `${input.story_title}-en`,
            chapter_title: `${input.chapter_title}-en`,
            text: `${input.text}-en`,
          };
        }
      }
      const bucket = new MemoryR2Bucket();
      const publisher = new Publisher(bucket, new SuffixTranslator());
      const chapter = await publisher.publish_chapter(
        "故事",
        "章节",
        0,
        0,
        "内容",
      );
      expect(chapter.story_title).toBe("故事-en");
      expect(chapter.chapter_title).toBe("章节-en");
      // HTML of translated text exists
      expect(await (await bucket.get("故事-en:章节-en:0.html"))?.text()).toBe(
        "<p>内容-en</p>\n",
      );
      // Story mapping uses translated story title and chapter title
      const mapping = JSON.parse(await (await bucket.get("故事-en"))!.text());
      expect(mapping).toStrictEqual([["故事-en:章节-en", 0, 1]]);
    });
  });
  describe("serialization", () => {
    test("Can reload from encoded R2", async () => {
      // Serialize and reload should preserve chapters and story mappings.
      const bucket = new MemoryR2Bucket();
      const publisher = new Publisher(bucket);
      await publisher.publish_chapter("story", "chapter", 0, 0, "blah");
      await publisher.publish_chapter("story", "chapter 2", 0, 0, "blah");
      await publisher.publish_chapter("story 2", "chapter", 0, 0, "blah");
      const publisher2 = await Publisher.deserialize(
        bucket,
        await publisher.serialize(),
      );

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
      expect(
        JSON.parse(await (await bucket.get("story"))!.text()),
      ).toStrictEqual([
        ["story:chapter", 0, 1],
        ["story:chapter 2", 0, 1],
      ]);
      expect(
        JSON.parse(await (await bucket.get("story 2"))!.text()),
      ).toStrictEqual([["story 2:chapter", 0, 1]]);
    });
  });
});
