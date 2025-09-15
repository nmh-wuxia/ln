import { describe, it, expect } from "vitest";
import { env, runInDurableObject } from "cloudflare:test";

describe("OpenAIProviderDO", () => {
  it("echoes messages in test mode", async () => {
    const id = env.LLM.idFromName("test");
    const stub: any = env.LLM.get(id);
    const result = await runInDurableObject(stub, (obj: any) =>
      obj.translate({
        api_key: "secret",
        model: "gpt-5-mini",
        messages: [{ role: "user", content: "hi" }],
      }),
    );
    expect(JSON.parse(result)).toEqual({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("returns 401 on unauthorized", async () => {
    const id = env.LLM.idFromName("auth");
    const stub: any = env.LLM.get(id);
    await expect(
      runInDurableObject(stub, (obj: any) =>
        obj.translate({
          api_key: "wrong",
          messages: [{ role: "user", content: "hi" }],
        }),
      ),
    ).rejects.toThrow("unauthorized");
  });

  it("enforces rate limits", async () => {
    const id = env.LLM.idFromName("rate");
    const stub: any = env.LLM.get(id);
    await runInDurableObject(stub, (obj: any) =>
      obj.translate({ api_key: "secret", messages: [{ role: "user", content: "1" }] }),
    );
    await runInDurableObject(stub, (obj: any) =>
      obj.translate({ api_key: "secret", messages: [{ role: "user", content: "2" }] }),
    );
    const err = await runInDurableObject(stub, async (obj: any) => {
      try {
        await obj.translate({
          api_key: "secret",
          messages: [{ role: "user", content: "3" }],
        });
        return null;
      } catch (e: any) {
        return e;
      }
    });
    expect(err).toBeTruthy();
    expect(err.message).toBe("rate_limited");
    expect(typeof err.retry_after).toBe("number");
  });

  it("requires messages", async () => {
    const id = env.LLM.idFromName("missing");
    const stub: any = env.LLM.get(id);
    await expect(
      runInDurableObject(stub, (obj: any) =>
        obj.translate({ api_key: "secret", messages: [] as any }),
      ),
    ).rejects.toThrow("missing messages array");
  });
});
