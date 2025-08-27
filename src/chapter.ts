import { marked } from "marked";

export class Chapter {
  r2: Record<string, string>;
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
  ) => void;
  last_synced_version: number;

  constructor(
    r2: Record<string, string>,
    story_title: string,
    chapter_title: string,
    when_free: number,
    cost: number,
    version: number = 0,
    text: string = "",
    update_story_map: (
      story_title: string,
      chapter_title: string,
      when_free: number,
      version: number,
    ) => void = () => {},
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
    if (text.length == 0) return;
    this.update(text);
  }
  is_free(now: number): boolean {
    return now >= this.when_free;
  }
  update(new_text: string) {
    const key = `${this.title}:${this.version}`;
    this.r2[key] = new_text;
    this.r2[`${key}.html`] = marked.parse(new_text, { async: false });
    this.version += 1;
    this.update_story_map(
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
  serialize(): string {
    let saved_state: any = {
      story_title: this.story_title,
      chapter_title: this.chapter_title,
      when_free: this.when_free,
      cost: this.cost,
      version: this.version,
      last_synced_version: this.last_synced_version,
    };
    for (let i = 0; i < this.version; ++i) {
      saved_state[i] = this.r2[`${this.title}:${i}`];
    }
    if (this.version > 0) {
      saved_state[this.version] = this.r2[`${this.title}:${this.version - 1}`];
    }
    return JSON.stringify(saved_state);
  }
  static deserialize(
    r2: Record<string, string>,
    str: string,
    update_story_map: (
      story_title: string,
      chapter_title: string,
      when_free: number,
      version: number,
    ) => void = () => {},
  ): Chapter {
    const saved_state = JSON.parse(str);
    const chapter = new Chapter(
      r2,
      saved_state.story_title,
      saved_state.chapter_title,
      saved_state.when_free,
      saved_state.cost,
      saved_state.version,
      "",
      update_story_map,
      saved_state.last_synced_version ?? saved_state.version,
    );
    for (let i = 0; i < chapter.version; ++i) {
      r2[`${chapter.title}:${i}`] = saved_state[i];
      r2[`${chapter.title}:${i}.html`] = marked.parse(saved_state[i], {
        async: false,
      });
    }
    const latest_text = saved_state[saved_state.version];
    if (latest_text !== undefined && chapter.version > 0) {
      r2[`${chapter.title}:${chapter.version - 1}`] = latest_text;
      r2[`${chapter.title}:${chapter.version - 1}.html`] = marked.parse(
        latest_text,
        { async: false },
      );
    }
    return chapter;
  }
}
