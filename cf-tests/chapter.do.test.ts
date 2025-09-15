import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";
import DiffMatchPatch from "diff-match-patch";

describe("ChapterDO", () => {
  it("initializes and retrieves text", async () => {
    const id = env.CHAPTER_DO.idFromName("story:chapter");
    const stub: any = env.CHAPTER_DO.get(id);
    const init = await stub.init({
      story_title: "story",
      chapter_title: "chapter",
      text: "Hello",
    });
    expect(init).toEqual({ ok: true, title: "story:chapter", version: 1 });
    const text = await stub.text();
    expect(text).toBe("Hello");
  });

  it("applies patches and bumps version", async () => {
    const id = env.CHAPTER_DO.idFromName("s:c");
    const stub: any = env.CHAPTER_DO.get(id);
    await stub.init({ story_title: "s", chapter_title: "c", text: "Hello" });
    const dmp = new DiffMatchPatch();
    const patch = dmp.patch_toText(dmp.patch_make("Hello", "Hello world"));
    const { id: patchId } = await stub.add_patch({ start: 5, end: 5, patch });
    const res = await stub.apply_patch({ id: patchId });
    expect(res).toEqual({ ok: true, version: 2 });
    const text = await stub.text();
    expect(text).toBe("Hello world");
  });

  it("returns error on invalid version", async () => {
    const id = env.CHAPTER_DO.idFromName("s:c2");
    const stub: any = env.CHAPTER_DO.get(id);
    await stub.init({ story_title: "s", chapter_title: "c2", text: "Hi" });
    const res = await stub.text({ version: 99 });
    expect(res).toEqual({ error: "invalid version" });
  });
});
