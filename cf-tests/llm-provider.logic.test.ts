import { describe, it, expect } from "vitest";
import { OpenAIProviderDO } from "~/do/llm-provider";

class MockState {
  storage: any = {};
  blockConcurrencyWhile = async (fn: any) => fn();
}

const baseEnv = {
  CHATGPT_API_KEY: "secret",
  OPENAI_MAX_PER_MINUTE: "2",
  LLM_TEST_MODE: "echo",
};

describe("OpenAIProviderDO direct", () => {
  it("echoes messages", async () => {
    const doObj = new OpenAIProviderDO(new MockState() as any, baseEnv);
    const res = await doObj.translate({
      api_key: "secret",
      model: "gpt-5-mini",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(JSON.parse(res)).toEqual({
      model: "gpt-5-mini",
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("enforces rate limits and auth", async () => {
    const doObj = new OpenAIProviderDO(new MockState() as any, baseEnv);
    await doObj.translate({ api_key: "secret", messages: [{ role: "user", content: "1" }] });
    await doObj.translate({ api_key: "secret", messages: [{ role: "user", content: "2" }] });
    await expect(
      doObj.translate({ api_key: "secret", messages: [{ role: "user", content: "3" }] }),
    ).rejects.toThrow("rate_limited");
    await expect(
      doObj.translate({ api_key: "bad", messages: [{ role: "user", content: "x" }] }),
    ).rejects.toThrow("unauthorized");
  });

  it("validates messages", async () => {
    const doObj = new OpenAIProviderDO(new MockState() as any, baseEnv);
    await expect(
      doObj.translate({ api_key: "secret", messages: [] as any }),
    ).rejects.toThrow("missing messages");
  });
});
