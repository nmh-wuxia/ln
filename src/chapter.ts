export class Chapter {
  version: number;
  when_free: number;
  cost: number;
  title: string;
  r2: Record<string, string>;

  constructor(
    r2: Record<string, string>,
    title: string,
    when_free: number,
    cost: number,
  ) {
    this.when_free = when_free;
    this.cost = cost;
    this.version = 0;
    this.title = title;
    this.r2 = r2;
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
}
