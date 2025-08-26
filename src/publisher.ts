import { Chapter } from "~/chapter";

export class Publisher {
  r2: Record<string, string>;
  stories: Record<string, Chapter[]>;

  constructor(r2: Record<string, string>) {
    this.r2 = r2;
    this.stories = {};
  }
  publish_chapter(
    story_title: string,
    chapter_title: string,
    when_free: number,
    cost: number,
    text: string,
  ): Chapter {
    let story = this.stories[story_title] || [];
    const new_id = story.length;
    const chapter = new Chapter(
      this.r2,
      `${story_title}:${chapter_title}`,
      when_free,
      cost,
      0,
      text,
    );
    story.push(chapter);
    this.stories[story_title] = story;
    this.r2[story_title] = JSON.stringify(
      /* TODO: Add chapter html link. */
      story.map((chapter) => [chapter.title, chapter.when_free]),
    );
    return chapter;
  }
  serialize(): string {
    let saved_state: Record<any, any> = {};
    for (const [story_title, story] of Object.entries(this.stories).filter(
      ([k, v]) => !k.includes(":"),
    )) {
      saved_state[story_title] = story.map((chapter): any =>
        JSON.parse(chapter.serialize()),
      );
    }
    return JSON.stringify(saved_state);
  }
  static deserialize(r2: Record<string, string>, str: string): Publisher {
    let publisher = new Publisher(r2);
    const saved_state: Record<any, any> = JSON.parse(str);
    for (const [story_title, story] of Object.entries(saved_state).filter(
      ([k, v]) => !k.includes(":"),
    )) {
      publisher.stories[story_title] = story.map((chapter: Chapter) =>
        Chapter.deserialize(r2, JSON.stringify(chapter)),
      );
    }
    return publisher;
  }
}
