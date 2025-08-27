import { describe, expect, test } from "vitest";
import { PatchManager } from "~/patch";

describe("PatchManager", () => {
  test("non overlapping patches create separate groups", () => {
    const pm = new PatchManager();
    pm.add({ id: "a", start: 0, end: 4 });
    pm.add({ id: "b", start: 10, end: 12 });
    expect(pm.groups.length).toBe(2);
    expect(pm.groups[0]!.patches.map((p) => p.id)).toEqual(["a"]);
    expect(pm.groups[1]!.patches.map((p) => p.id)).toEqual(["b"]);
  });
  test("overlapping patches end up in the same group", () => {
    const pm = new PatchManager();
    pm.add({ id: "a", start: 0, end: 4 });
    pm.add({ id: "b", start: 3, end: 8 });
    expect(pm.groups.length).toBe(1);
    expect(pm.groups[0]!.start).toBe(0);
    expect(pm.groups[0]!.end).toBe(8);
    expect(pm.groups[0]!.patches.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });
  test("bridge patch merges groups", () => {
    const pm = new PatchManager();
    pm.add({ id: "a", start: 0, end: 2 });
    pm.add({ id: "b", start: 10, end: 12 });
    pm.add({ id: "c", start: 1, end: 11 });
    expect(pm.groups.length).toBe(1);
    expect(pm.groups[0]!.start).toBe(0);
    expect(pm.groups[0]!.end).toBe(12);
    expect(pm.groups[0]!.patches.map((p) => p.id).sort()).toEqual(["a", "b", "c"]);
  });
  test("insertion patches overlap when inside range", () => {
    const pm = new PatchManager();
    pm.add({ id: "a", start: 5, end: 10 });
    pm.add({ id: "b", start: 3, end: 3 });
    pm.add({ id: "c", start: 7, end: 7 });
    expect(pm.groups.length).toBe(2);
    expect(pm.groups[0]!.patches.map((p) => p.id)).toEqual(["b"]);
    expect(pm.groups[1]!.patches.map((p) => p.id).sort()).toEqual(["a", "c"]);
  });
});
