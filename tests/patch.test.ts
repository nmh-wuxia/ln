import { describe, expect, test } from "vitest";
import { PatchManager } from "~/patch";
import DiffMatchPatch from "diff-match-patch";

describe("PatchManager", () => {
  test("handles non-overlap merging", () => {
    // Non-overlapping ranges => distinct groups, create separate groups
    const pm = new PatchManager();
    const a = pm.add({ start: 0, end: 4, patch: "" });
    const b = pm.add({ start: 10, end: 12, patch: "" });
    expect(pm.groups.length).toBe(2);
    expect(pm.groups[0]!.patches.map((p) => p.id)).toEqual([a]);
    expect(pm.groups[1]!.patches.map((p) => p.id)).toEqual([b]);
  });
  test("handles overlap merging", () => {
    // Overlapping ranges => single merged group with expanded bounds
    const pm = new PatchManager();
    const a = pm.add({ start: 0, end: 4, patch: "" });
    const b = pm.add({ start: 3, end: 8, patch: "" });
    expect(pm.groups.length).toBe(1);
    expect(pm.groups[0]!.start).toBe(0);
    expect(pm.groups[0]!.end).toBe(8);
    expect(pm.groups[0]!.patches.map((p) => p.id).sort()).toEqual([a, b]);
  });
  test("handles and bridge merging", () => {
    // Bridge range connects two groups => single merged group
    const pm = new PatchManager();
    const a = pm.add({ start: 0, end: 2, patch: "" });
    const b = pm.add({ start: 10, end: 12, patch: "" });
    const c = pm.add({ start: 1, end: 11, patch: "" });
    expect(pm.groups.length).toBe(1);
    expect(pm.groups[0]!.start).toBe(0);
    expect(pm.groups[0]!.end).toBe(12);
    expect(pm.groups[0]!.patches.map((p) => p.id).sort()).toEqual([a, b, c]);
  });
  test("insertion patches overlap when inside range", () => {
    const pm = new PatchManager();
    const a = pm.add({ start: 5, end: 10, patch: "" });
    const b = pm.add({ start: 3, end: 3, patch: "" });
    const c = pm.add({ start: 7, end: 7, patch: "" });
    expect(pm.groups.length).toBe(2);
    expect(pm.groups[0]!.patches.map((p) => p.id)).toEqual([b]);
    expect(pm.groups[1]!.patches.map((p) => p.id).sort()).toEqual([a, c]);
  });

  test("applyById applies patch and returns updated text", () => {
    const pm = new PatchManager();
    const dmp = new DiffMatchPatch();
    const patchText = dmp.patch_toText(dmp.patch_make("Hello", "Hello world"));
    const id = pm.add({ start: 5, end: 5, patch: patchText });
    const out = pm.applyById("Hello", id);
    expect(out).toBe("Hello world");
    // Applying removes the conflicting group; since only one group existed, expect 0 remaining
    expect(pm.groups.length).toBe(0);
  });

  test("applyById throws for unknown id", () => {
    const pm = new PatchManager();
    expect(() => pm.applyById("Hello", "missing")).toThrow(/patch id not found/);
  });

  test("add throws on invalid patch text", () => {
    const pm = new PatchManager();
    expect(() => pm.add({ start: 0, end: 0, patch: "@@ invalid" })).toThrow(
      /invalid patch text/,
    );
  });

  test("applyById throws when patch cannot apply cleanly", () => {
    const pm = new PatchManager();
    const dmp = new DiffMatchPatch();
    // Create a patch that definitely won't match the target text
    const patchText = dmp.patch_toText(
      dmp.patch_make("ABCDEFG", "ABCDEFG world"),
    );
    const id = pm.add({ start: 7, end: 7, patch: patchText });
    expect(() => pm.applyById("Hello", id)).toThrow(/patch did not apply cleanly/);
  });

  test("applyById removes only conflicting group and keeps others", () => {
    const pm = new PatchManager();
    const dmp = new DiffMatchPatch();
    const a = dmp.patch_toText(dmp.patch_make("Hello", "Hello world"));
    const aId = pm.add({ start: 5, end: 5, patch: a });
    // Add another patch that overlaps (same group)
    pm.add({ start: 4, end: 6, patch: "" });
    // Add a non-conflicting patch (separate group)
    const cId = pm.add({ start: 20, end: 21, patch: "" });
    const out = pm.applyById("Hello", aId);
    expect(out).toBe("Hello world");
    expect(pm.groups.length).toBe(1);
    expect(pm.groups[0]!.patches.map((p) => p.id)).toEqual([cId]);
  });
});
