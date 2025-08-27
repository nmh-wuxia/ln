export interface Patch {
  id: string;
  start: number;
  end: number;
}

export interface PatchConflictGroup {
  start: number;
  end: number;
  patches: Patch[];
}

function overlaps(a: { start: number; end: number }, b: { start: number; end: number }): boolean {
  return a.start <= b.end && b.start <= a.end;
}

export class PatchManager {
  groups: PatchConflictGroup[] = [];

  add(patch: Patch) {
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
  }
}
