import { Chapter } from "~/chapter";

export class Publisher {
  r2: Record<string, string>;
  metadata: Record<string, [string, number, Chapter][]>;

  constructor(r2: Record<string, string>) {
    this.r2 = r2;
    this.metadata = {};
  }
  publish_chapter(
    story_title: string,
    chapter_title: string,
    when_free: number,
    cost: number,
    text: string,
  ): Chapter {
    let story_meta = this.metadata[story_title] || [];
    const new_id = story_meta.length;
    const chapter = new Chapter(
      this.r2,
      `${story_title}:${chapter_title}`,
      when_free,
      cost,
    );
    chapter.update(text); // Push first text
    story_meta.push([chapter.title, chapter.when_free, chapter]);
    this.metadata[story_title] = story_meta;
    this.r2[story_title] = JSON.stringify(story_meta);
    return chapter;
  }
}
