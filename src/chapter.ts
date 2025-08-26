export class Chapter {
  version: number;
  when_free: number;
  cost: number;
  name: string;
  r2: Record<string, string>;

  constructor(
    r2: Record<string, string>,
    name: string,
    when_free: number,
    cost: number,
  ) {
    this.when_free = when_free;
    this.cost = cost;
    this.version = 0;
    this.name = name;
    this.r2 = r2;
  }

  is_free(now: number): boolean {
    return now >= this.when_free;
  }

  update(new_text: string) {
    this.r2[`${this.name}:${this.version}`] = new_text;
    this.version += 1;
  }

  text(version: number) {
    return this.r2[`${this.name}:${version}`];
  }
}
