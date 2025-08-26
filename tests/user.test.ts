import { describe, expect, test } from "vitest";
import { User } from "~/user";

describe("User math", () => {
  test("User defaults to zero credits", () => {
    let user = new User({});
    expect(user.has_credits(1)).toBe(false);
  });
  test("User credit math", () => {
    let user = new User({});
    expect(user.has_credits(1)).toBe(false);
    user.add_credits(1);
    expect(user.has_credits(1)).toBe(true);
  });
});
