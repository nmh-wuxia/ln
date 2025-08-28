import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import type { ChapterTranslationInput } from "~/translator";
import { DeepSeekTranslator } from "~/translator";

const DUMMY_KEY = "test-deepseek-key";

describe("DeepSeekTranslator", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  test("throws if API key missing", async () => {
    delete process.env.DEEPSEEK_API_KEY;
    await expect(
      (async () => new DeepSeekTranslator())(),
    ).rejects.toThrow(/DEEPSEEK_API_KEY/);
  });

  test("translates using combined plaintext format", async () => {
    process.env.DEEPSEEK_API_KEY = DUMMY_KEY;
    const input: ChapterTranslationInput = {
      story_title: "故事",
      chapter_title: "章节",
      text: "内容",
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: { content: "Story\n-----\nChapter\n-----\nContent" },
          },
        ],
      }),
    } as any);

    const t = new DeepSeekTranslator();
    const out = await t.translate(input);

    expect(out).toStrictEqual({
      story_title: "Story",
      chapter_title: "Chapter",
      text: "Content",
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  test("throws on non-OK response (first call)", async () => {
    process.env.DEEPSEEK_API_KEY = DUMMY_KEY;
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    } as any);

    const t = new DeepSeekTranslator();
    await expect(
      t.translate({ story_title: "s", chapter_title: "c", text: "t" }),
    ).rejects.toThrow(/DeepSeek API error/);
  });

  test("throws when combined format invalid (missing first dashes)", async () => {
    process.env.DEEPSEEK_API_KEY = DUMMY_KEY;
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          { message: { content: "Story\nnot-dashes\nChapter\n-----\nContent" } },
        ],
      }),
    } as any);
    const t = new DeepSeekTranslator();
    await expect(
      t.translate({ story_title: "s", chapter_title: "c", text: "t" }),
    ).rejects.toThrow(/missing first dashed separator|format invalid/);
  });

  test("throws when chapter missing title/body", async () => {
    process.env.DEEPSEEK_API_KEY = DUMMY_KEY;
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [{ message: { content: "Story\n-----\n\n-----\n" } }],
      }),
    } as any);
    const t = new DeepSeekTranslator();
    await expect(
      t.translate({ story_title: "s", chapter_title: "c", text: "t" }),
    ).rejects.toThrow(/missing chapter title or body|empty story title/);
  });

  test("throws when combined format too short", async () => {
    process.env.DEEPSEEK_API_KEY = DUMMY_KEY;
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: { content: "Only one line" } }] }),
    } as any);
    const t = new DeepSeekTranslator();
    await expect(
      t.translate({ story_title: "s", chapter_title: "c", text: "t" }),
    ).rejects.toThrow(/format invalid/);
  });

  test("throws when API returns no content", async () => {
    process.env.DEEPSEEK_API_KEY = DUMMY_KEY;
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [{ message: {} }] }),
    } as any);
    const t = new DeepSeekTranslator();
    await expect(
      t.translate({ story_title: "s", chapter_title: "c", text: "t" }),
    ).rejects.toThrow(/no content/);
  });

  test("throws when story title comes back empty", async () => {
    process.env.DEEPSEEK_API_KEY = DUMMY_KEY;
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          { message: { content: "   \n-----\nChapter\n-----\nBody" } },
        ],
      }),
    } as any);
    const t = new DeepSeekTranslator();
    await expect(
      t.translate({ story_title: "s", chapter_title: "c", text: "t" }),
    ).rejects.toThrow(/empty story title/);
  });
});
