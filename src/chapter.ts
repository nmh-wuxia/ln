import { marked } from "marked";
import type { R2Bucket } from "~/r2";

export class Chapter {
  r2: R2Bucket;
  story_title: string;
  chapter_title: string;
  title: string;
  when_free: number;
  cost: number;
  version: number;
  update_story_map: (
    story_title: string,
    chapter_title: string,
    when_free: number,
    version: number,
  ) => Promise<void>;
  last_synced_version: number;

  constructor(
    r2: R2Bucket,
    story_title: string,
    chapter_title: string,
    when_free: number,
    cost: number,
    version: number = 0,
    update_story_map: (
      story_title: string,
      chapter_title: string,
      when_free: number,
      version: number,
    ) => Promise<void> = async () => {},
    last_synced_version: number = version,
  ) {
    this.r2 = r2;
    this.story_title = story_title;
    this.chapter_title = chapter_title;
    this.title = `${story_title}:${chapter_title}`;
    this.when_free = when_free;
    this.cost = cost;
    this.version = version;
    this.update_story_map = update_story_map;
    this.last_synced_version = last_synced_version;
  }
  is_free(now: number): boolean {
    return now >= this.when_free;
  }
  async update(new_text: string) {
    const key = `${this.title}:${this.version}`;
    await this.r2.put(key, new_text);
    await this.r2.put(`${key}.html`, marked.parse(new_text, { async: false }));
    this.version += 1;
    await this.update_story_map(
      this.story_title,
      this.chapter_title,
      this.when_free,
      this.version,
    );
    this.last_synced_version = this.version;
  }
  key(version: number): string {
    return `${this.title}:${version}`;
  }
  async serialize(): Promise<string> {
    let saved_state: any = {
      story_title: this.story_title,
      chapter_title: this.chapter_title,
      when_free: this.when_free,
      cost: this.cost,
      version: this.version,
      last_synced_version: this.last_synced_version,
    };
    for (let i = 0; i < this.version; ++i) {
      const obj = await this.r2.get(`${this.title}:${i}`);
      saved_state[i] = obj ? await obj.text() : undefined;
    }
    if (this.version > 0) {
      const obj = await this.r2.get(`${this.title}:${this.version - 1}`);
      saved_state[this.version] = obj ? await obj.text() : undefined;
    }
    return JSON.stringify(saved_state);
  }
  static async deserialize(
    r2: R2Bucket,
    str: string,
    update_story_map: (
      story_title: string,
      chapter_title: string,
      when_free: number,
      version: number,
    ) => Promise<void> = async () => {},
  ): Promise<Chapter> {
    const saved_state = JSON.parse(str);
    const chapter = new Chapter(
      r2,
      saved_state.story_title,
      saved_state.chapter_title,
      saved_state.when_free,
      saved_state.cost,
      saved_state.version,
      update_story_map,
      saved_state.last_synced_version ?? saved_state.version,
    );
    for (let i = 0; i < chapter.version; ++i) {
      const text = saved_state[i];
      await r2.put(`${chapter.title}:${i}`, text);
      await r2.put(
        `${chapter.title}:${i}.html`,
        marked.parse(text, { async: false }),
      );
    }
    const latest_text = saved_state[saved_state.version];
    if (latest_text !== undefined && chapter.version > 0) {
      await r2.put(`${chapter.title}:${chapter.version - 1}`, latest_text);
      await r2.put(
        `${chapter.title}:${chapter.version - 1}.html`,
        marked.parse(latest_text, { async: false }),
      );
    }
    return chapter;
  }
}
