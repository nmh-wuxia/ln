import { Chapter } from "~/chapter";
import type { R2Bucket } from "~/r2";

export class Publisher {
  r2: R2Bucket;
  stories: Record<string, Record<string, Chapter>>;

  constructor(r2: R2Bucket) {
    this.r2 = r2;
    this.stories = {};
  }
  update_story_map = async (
    story_title: string,
    chapter_title: string,
    when_free: number,
    version: number,
  ) => {
    const story = this.stories[story_title];
    if (!story) return;
    const mapping: [string, number, number][] = Object.values(story).map(
      (chapter) => [chapter.title, chapter.when_free, chapter.version],
    );
    await this.r2.put(story_title, JSON.stringify(mapping));
  };
  async publish_chapter(
    story_title: string,
    chapter_title: string,
    when_free: number,
    cost: number,
    text: string,
  ): Promise<Chapter> {
    let story = this.stories[story_title] || {};
    const chapter = new Chapter(
      this.r2,
      story_title,
      chapter_title,
      when_free,
      cost,
      0,
      this.update_story_map,
    );
    story[chapter_title] = chapter;
    this.stories[story_title] = story;
    if (text.length > 0) {
      await chapter.update(text);
    } else {
      await this.update_story_map(
        story_title,
        chapter_title,
        when_free,
        chapter.version,
      );
      chapter.last_synced_version = chapter.version;
    }
    return chapter;
  }
  async serialize(): Promise<string> {
    let saved_state: Record<any, any> = {};
    for (const [story_title, story] of Object.entries(this.stories).filter(
      ([k]) => !k.includes(":"),
    )) {
      saved_state[story_title] = await Promise.all(
        Object.values(story).map(async (chapter): Promise<any> =>
          JSON.parse(await chapter.serialize()),
        ),
      );
    }
    return JSON.stringify(saved_state);
  }
  static async deserialize(r2: R2Bucket, str: string): Promise<Publisher> {
    let publisher = new Publisher(r2);
    const saved_state: Record<any, any> = JSON.parse(str);
    for (const [story_title, story] of Object.entries(saved_state).filter(
      ([k]) => !k.includes(":"),
    )) {
      publisher.stories[story_title] = {};
      for (const chapter of story as any[]) {
        const ch = await Chapter.deserialize(
          r2,
          JSON.stringify(chapter),
          publisher.update_story_map,
        );
        publisher.stories[story_title][ch.chapter_title] = ch;
        const start = ch.last_synced_version;
        for (let v = start; v < ch.version; v++) {
          await publisher.update_story_map(
            story_title,
            ch.chapter_title,
            ch.when_free,
            v + 1,
          );
          ch.last_synced_version = v + 1;
        }
        if (start === ch.last_synced_version) {
          await publisher.update_story_map(
            story_title,
            ch.chapter_title,
            ch.when_free,
            ch.version,
          );
        }
      }
    }
    return publisher;
  }
}
