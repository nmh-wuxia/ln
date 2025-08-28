import { describe, expect, test, vi } from "vitest";
import { Chapter } from "~/chapter";
import { User } from "~/user";
import { MemoryR2Bucket } from "~/r2";

// Basic credit math and ownership rely on Chapter.is_free internally.
describe("User", () => {
  test("credit math works", () => {
    const user = new User(new Set());
    expect(user.has_credits(1)).toBe(false);
    user.add_credits(1);
    expect(user.has_credits(1)).toBe(true);
  });
});
describe("User ownership", () => {
  const bucket = new MemoryR2Bucket();
  const expired_chapter = new Chapter(bucket, "story", "expired", 0, 3, "t");
  const active_chapter = new Chapter(
    bucket,
    "story",
    "active",
    9999999999,
    1,
    "t",
  );
  const expensive_chapter = new Chapter(
    bucket,
    "story",
    "expensive",
    9999999999,
    50,
    "t",
  );

  test("owns expired chapters for free", () => {
    const user = new User(new Set());
    expect(user.owns(0, expired_chapter)).toBe(true);
  });
  test("doesn't own active chapters for free", () => {
    const user = new User(new Set());
    expect(user.owns(0, active_chapter)).toBe(false);
  });
  test("can buy chapters it can afford", () => {
    const user = new User(new Set());
    user.add_credits(1);
    const spy = vi.spyOn(user, "payment_flow");
    expect(user.own(0, active_chapter)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(0);
  });
  test("can buy chapters with payment_flow when needed", () => {
    const user = new User(new Set());
    user.add_credits(1);
    const spy = vi.spyOn(user, "payment_flow");
    expect(user.own(0, expensive_chapter)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
  });
  test("can't buy chapters it can't afford", () => {
    const user = new User(new Set());
    user.add_credits(1);
    const spy = vi.spyOn(user, "payment_flow");
    spy.mockImplementation(() => false);
    expect(user.own(0, expensive_chapter)).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
  });
  test("correctly verifies bought chapters", () => {
    const user = new User(new Set());
    user.add_credits(1);
    user.own(0, active_chapter);
    expect(user.owns(0, active_chapter)).toBe(true);
    expect(user.own(0, active_chapter)).toBe(true);
  });
});
