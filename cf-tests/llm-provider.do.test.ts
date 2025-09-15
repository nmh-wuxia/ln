import { describe, it, expect } from "vitest";
import { env } from "cloudflare:test";

async function call(stub: any, body: any) {
  const res = await stub.fetch("https://do/translate", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { res, json };
}

describe("OpenAIProviderDO", () => {
  it("echoes messages in test mode", async () => {
    const ns = env.LLM;
    const stub: any = ns.get(ns.idFromName("test"));
    const { res, json } = await call(stub, {
      api_key: "secret",
      model: "gpt-5-mini",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.status).toBe(200);
    expect(JSON.parse(json.result)).toEqual({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("returns 401 on unauthorized", async () => {
    const ns = env.LLM;
    const stub: any = ns.get(ns.idFromName("auth"));
    const { res, json } = await call(stub, {
      api_key: "wrong",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(res.status).toBe(401);
    expect(json.error).toBe("unauthorized");
  });

  it("enforces rate limits", async () => {
    const ns = env.LLM;
    const stub: any = ns.get(ns.idFromName("rate"));
    await call(stub, { api_key: "secret", messages: [{ role: "user", content: "1" }] });
    await call(stub, { api_key: "secret", messages: [{ role: "user", content: "2" }] });
    const { res, json } = await call(stub, {
      api_key: "secret",
      messages: [{ role: "user", content: "3" }],
    });
    expect(res.status).toBe(429);
    expect(json.error).toBe("rate_limited");
    expect(json.retry_after).toBeTypeOf("number");
  });

  it("requires messages", async () => {
    const ns = env.LLM;
    const stub: any = ns.get(ns.idFromName("missing"));
    const { res, json } = await call(stub, {
      api_key: "secret",
      messages: [] as any,
    });
    expect(res.status).toBe(400);
    expect(json.error).toBe("missing messages array");
  });
});
