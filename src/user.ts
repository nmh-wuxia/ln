export class User {
  storage: Record<string, string>;
  credits: number;

  constructor(storage: Record<string, string>) {
    this.storage = storage;
    this.credits = 0;
  }

  has_credits(cost: number): boolean {
    return this.credits >= cost;
  }

  add_credits(credits: number) {
    this.credits += credits;
  }

  // Model paying out to stripe and returning new credits
  payment_flow(): number {
    return 500;
  }
}
