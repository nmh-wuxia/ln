import { describe, it, expect } from "vitest";
import { env, runInDurableObject } from "cloudflare:test";
import DiffMatchPatch from "diff-match-patch";

describe("ChapterDO", () => {
  it("initializes and retrieves text", async () => {
    const id = env.CHAPTER_DO.idFromName("story:chapter");
    const stub: any = env.CHAPTER_DO.get(id);
    const result = await runInDurableObject(stub, async (obj: any) => {
      const init = await obj.init({
        story_title: "story",
        chapter_title: "chapter",
        text: "Hello",
      });
      const text = await obj.text();
      return { init, text };
    });
    expect(result.init).toEqual({ ok: true, title: "story:chapter", version: 1 });
    expect(result.text).toBe("Hello");
  });

  it("applies patches and bumps version", async () => {
    const id = env.CHAPTER_DO.idFromName("s:c");
    const stub: any = env.CHAPTER_DO.get(id);
    const dmp = new DiffMatchPatch();
    const result = await runInDurableObject(stub, async (obj: any) => {
      await obj.init({ story_title: "s", chapter_title: "c", text: "Hello" });
      const patch = dmp.patch_toText(dmp.patch_make("Hello", "Hello world"));
      const { id: patchId } = await obj.add_patch({ start: 5, end: 5, patch });
      const res = await obj.apply_patch({ id: patchId });
      const text = await obj.text();
      return { res, text };
    });
    expect(result.res).toEqual({ ok: true, version: 2 });
    expect(result.text).toBe("Hello world");
  });

  it("returns error on invalid version", async () => {
    const id = env.CHAPTER_DO.idFromName("s:c2");
    const stub: any = env.CHAPTER_DO.get(id);
    const res = await runInDurableObject(stub, async (obj: any) => {
      await obj.init({ story_title: "s", chapter_title: "c2", text: "Hi" });
      return obj.text({ version: 99 });
    });
    expect(res).toEqual({ error: "invalid version" });
  });
});
