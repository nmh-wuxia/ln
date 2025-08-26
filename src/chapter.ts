export class Chapter {
  r2: Record<string, string>;
  title: string;
  when_free: number;
  cost: number;
  version: number;

  constructor(
    r2: Record<string, string>,
    title: string,
    when_free: number,
    cost: number,
    version: number = 0,
    text: string = "",
  ) {
    this.r2 = r2;
    this.title = title;
    this.when_free = when_free;
    this.cost = cost;
    this.version = version;
    if (text.length == 0) return;
    this.update(text);
  }
  is_free(now: number): boolean {
    return now >= this.when_free;
  }
  update(new_text: string) {
    this.r2[`${this.title}:${this.version}`] = new_text;
    this.version += 1;
  }
  key(version: number): string {
    return `${this.title}:${version}`;
  }
  serialize(): string {
    let saved_state: any = {
      title: this.title,
      when_free: this.when_free,
      cost: this.cost,
      version: this.version,
    };
    for (let i = 0; i < this.version; ++i) {
      saved_state[i] = this.r2[`${this.title}:${i}`];
    }
    return JSON.stringify(saved_state);
  }
  static deserialize(r2: Record<string, string>, str: string): Chapter {
    let saved_state = JSON.parse(str);
    let chapter = new Chapter(
      r2,
      saved_state.title,
      saved_state.when_free,
      saved_state.cost,
      saved_state.version,
    );
    for (let i = 0; i < chapter.version; ++i) {
      r2[`${chapter.title}:${i}`] = saved_state[i];
    }
    return chapter;
  }
}
