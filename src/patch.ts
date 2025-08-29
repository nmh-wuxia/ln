import DiffMatchPatch from "diff-match-patch";

export interface Patch {
  id: string;
  start: number;
  end: number;
  // diff-match-patch textual patch (from patch_toText)
  patch: string;
}

export interface PatchInput {
  start: number;
  end: number;
  patch: string;
}

export interface PatchConflictGroup {
  start: number;
  end: number;
  patches: Patch[];
}

function overlaps(
  a: { start: number; end: number },
  b: { start: number; end: number },
): boolean {
  return a.start <= b.end && b.start <= a.end;
}

export class PatchManager {
  groups: PatchConflictGroup[] = [];

  private _counter = 0;
  private dmp = new DiffMatchPatch();

  /*
   * Validate the patch text
   * assign an id
   * insert into conflict groups
   * return the id
   */
  add(input: PatchInput): string {
    // Validate textual patch
    try {
      this.dmp.patch_fromText(input.patch ?? "");
    } catch (e) {
      throw new Error("invalid patch text");
    }
    const id = `p${++this._counter}`;
    const patch: Patch = {
      id,
      start: input.start,
      end: input.end,
      patch: input.patch,
    };

    let start = patch.start;
    let end = patch.end;
    const collected: Patch[] = [patch];
    const newGroups: PatchConflictGroup[] = [];
    let inserted = false;
    for (const g of this.groups) {
      if (overlaps({ start, end }, g)) {
        start = Math.min(start, g.start);
        end = Math.max(end, g.end);
        collected.push(...g.patches);
      } else {
        if (!inserted && g.start > end) {
          newGroups.push({ start, end, patches: collected });
          inserted = true;
        }
        newGroups.push(g);
      }
    }
    if (!inserted) {
      newGroups.push({ start, end, patches: collected });
    }
    this.groups = newGroups;
    return id;
  }

  /*
   * Apply the patch identified by the id from add()
   */
  applyById(text: string, id: string): string {
    let groupIndex = -1;
    let patch: Patch | undefined;
    for (let i = 0; i < this.groups.length; i++) {
      const g = this.groups[i]!;
      const idx = g.patches.findIndex((pp) => pp.id === id);
      if (idx !== -1) {
        groupIndex = i;
        patch = g.patches[idx];
        break;
      }
    }
    if (!patch) throw new Error("patch id not found");
    const patches = this.dmp.patch_fromText(patch.patch ?? "");
    const [next, results] = this.dmp.patch_apply(patches, text);
    if (Array.isArray(results) && results.some((r) => r === false)) {
      throw new Error("patch did not apply cleanly");
    }
    // Remove the entire conflicting group (the one containing this patch)
    if (groupIndex !== -1) {
      this.groups = this.groups.filter((_, i) => i !== groupIndex);
    }
    return next;
  }
}
