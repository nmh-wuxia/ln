import { describe, expect, test } from "vitest";
import { Chapter } from "~/chapter";
import { User } from "~/user";

describe("User", () => {
  test("defaults to zero credits", () => {
    let user = new User(new Set());
    expect(user.has_credits(1)).toBe(false);
  });
  test("credit math works", () => {
    let user = new User(new Set());
    expect(user.has_credits(1)).toBe(false);
    user.add_credits(1);
    expect(user.has_credits(1)).toBe(true);
  });
});
describe("User ownership", () => {
  let r2 = {};
  let expired_chapter = new Chapter(r2, "expired", 0, 3);
  let active_chapter = new Chapter(r2, "active", 9999999999, 1);
  let expensive_chapter = new Chapter(r2, "active", 9999999999, 50);

  test("owns expired chapters for free", () => {
    let user = new User(new Set());
    expect(user.owns(0, expired_chapter)).toBe(true);
  });
  test("doesn't own active chapters for free", () => {
    let user = new User(new Set());
    expect(user.owns(0, active_chapter)).toBe(false);
  });
  test("can buy chapters it can afford", () => {
    let user = new User(new Set());
    user.add_credits(1);
    expect(user.own(0, active_chapter)).toBe(true);
  });
  test("can't buy chapters it can't afford", () => {
    let user = new User(new Set());
    user.add_credits(1);
    expect(user.own(0, expensive_chapter)).toBe(false);
  });
  test("correctly verifies bought chapters", () => {
    let user = new User(new Set());
    user.add_credits(1);
    user.own(0, active_chapter);
    expect(user.owns(0, active_chapter)).toBe(true);
    expect(user.own(0, active_chapter)).toBe(true);
  });
});
