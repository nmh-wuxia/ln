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
    if (this.version === 0) return JSON.stringify(saved_state);
    for (let i = 0; i < this.version - 1; ++i) {
      const key = this.key(i);
      const obj = await this.r2.get(key);
      if (!obj) throw new Error(`missing text for ${key}`);
      saved_state[i] = await obj.text();
    }
    const key = this.key(this.version - 1);
    const obj = await this.r2.get(key);
    if (!obj) throw new Error(`missing text for ${key}`);
    const text = await obj.text();
    saved_state[this.version - 1] = text;
    saved_state[this.version] = text;
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
    if (chapter.version === 0) return chapter;
    for (let i = 0; i < chapter.version - 1; ++i) {
      const text = saved_state[i];
      await r2.put(chapter.key(i), text);
      await r2.put(
        `${chapter.key(i)}.html`,
        marked.parse(text, { async: false }),
      );
    }
    const latest_text = saved_state[saved_state.version];
    await r2.put(chapter.key(chapter.version - 1), latest_text);
    await r2.put(
      `${chapter.key(chapter.version - 1)}.html`,
      marked.parse(latest_text, { async: false }),
    );
    return chapter;
  }
}
