import { describe, expect, test, vi, beforeEach, afterEach } from "vitest";
import { Publisher } from "~/publisher";
import { MemoryR2Bucket } from "~/r2";

const DUMMY_KEY = "test-deepseek-key";

describe("Publisher + DeepSeekTranslator (auto-wiring)", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  test("uses DeepSeek when DEEPSEEK_API_KEY is set", async () => {
    process.env.DEEPSEEK_API_KEY = DUMMY_KEY;
    const bucket = new MemoryR2Bucket();

    // Mock combined DeepSeek response: story, dashes, chapter, dashes, content
    vi.spyOn(globalThis, "fetch" as any).mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: { content: "故事-en\n-----\n章节-en\n-----\n内容-en" },
          },
        ],
      }),
    } as any);

    const publisher = new Publisher(bucket);
    const ch = await publisher.publish_chapter("故事", "章节", 0, 0, "内容");
    expect(ch.story_title).toBe("故事-en");
    expect(ch.chapter_title).toBe("章节-en");
    expect(await (await bucket.get("故事-en:章节-en:0.html"))?.text()).toBe(
      "<p>内容-en</p>\n",
    );
    const mapping = JSON.parse(await (await bucket.get("故事-en"))!.text());
    expect(mapping).toStrictEqual([["故事-en:章节-en", 0, 1]]);
  });
});
