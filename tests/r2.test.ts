import { describe, expect, test } from "vitest";
import { MemoryR2Bucket } from "~/r2";

describe("MemoryR2Bucket", () => {
  test("list filters by prefix", async () => {
    const r2 = new MemoryR2Bucket({
      "a:1": "1",
      "a:2": "2",
      "b:1": "3",
    });
    const res = await r2.list({ prefix: "a:" });
    const keys = res.objects.map((o) => o.key).sort();
    expect(keys).toStrictEqual(["a:1", "a:2"]);
  });
});
