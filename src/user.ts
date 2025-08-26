import { Chapter } from "~/chapter";
export class User {
  owned_stories: Set<string>;
  credits: number;

  constructor(owned_stories: Set<string>) {
    this.owned_stories = owned_stories;
    this.credits = 0;
  }
  has_credits(cost: number): boolean {
    return this.credits >= cost;
  }
  add_credits(credits: number) {
    this.credits += credits;
  }
  owns(now: number, chapter: Chapter): boolean {
    if (chapter.is_free(now)) return true;
    if (this.owned_stories.has(chapter.name)) return true;
    return false;
  }
  own(now: number, chapter: Chapter): boolean {
    if (this.owns(now, chapter)) return true;
    if (this.credits >= chapter.cost) {
      this.owned_stories.add(chapter.name);
      this.credits -= chapter.cost;
      return true;
    }
    if (this.payment_flow()) {
      this.owned_stories.add(chapter.name);
      this.credits -= chapter.cost;
      return true;
    }
    return false;
  }
  // Model paying out to stripe and returning new credits
  payment_flow(): boolean {
    this.credits += 500;
    return true;
  }
}
