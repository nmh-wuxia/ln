import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";

describe("OpenAIProviderDO", () => {
  it("echoes messages in test mode", async () => {
    const ns = env.LLM;
    const stub: any = ns.get(ns.idFromName("test"));
    const res = await stub.translate({
      api_key: "secret",
      model: "gpt-5-mini",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(JSON.parse(res)).toEqual({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("throws on unauthorized", async () => {
    const ns = env.LLM;
    const stub: any = ns.get(ns.idFromName("auth"));
    await expect(
      stub.translate({ api_key: "wrong", messages: [{ role: "user", content: "hi" }] })
    ).rejects.toThrow("unauthorized");
  });

  it("enforces rate limits", async () => {
    const ns = env.LLM;
    const stub: any = ns.get(ns.idFromName("rate"));
    await stub.translate({ api_key: "secret", messages: [{ role: "user", content: "1" }] });
    await stub.translate({ api_key: "secret", messages: [{ role: "user", content: "2" }] });
    await expect(
      stub.translate({ api_key: "secret", messages: [{ role: "user", content: "3" }] })
    ).rejects.toThrow("rate_limited");
  });

  it("requires messages", async () => {
    const ns = env.LLM;
    const stub: any = ns.get(ns.idFromName("missing"));
    await expect(
      stub.translate({ api_key: "secret", messages: [] as any })
    ).rejects.toThrow("missing messages array");
  });
});
