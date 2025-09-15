import { describe, it, expect } from "vitest";
import { Miniflare } from "miniflare";
import { join } from "node:path";
import { readFileSync } from "node:fs";
import ts from "typescript";

async function createMf(bindings: Record<string, any> = {}) {
  const doPath = join(process.cwd(), "src/do/llm-provider.ts");
  const doSrc = readFileSync(doPath, "utf8");
  const { outputText: doJs } = ts.transpileModule(doSrc, {
    compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 },
  });
  const workerSrc = `import { OpenAIProviderDO } from "./llm-provider.js";\nexport { OpenAIProviderDO };\nexport default { fetch() { return new Response("ok"); } };`;
  const { outputText: workerJs } = ts.transpileModule(workerSrc, {
    compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 },
  });
  return new Miniflare({
    modules: [
      { type: "ESModule", path: "llm-provider.js", contents: doJs },
      { type: "ESModule", path: "worker.js", contents: workerJs },
    ],
    durableObjects: { LLM: { className: "OpenAIProviderDO" } },
    compatibilityDate: "2024-08-01",
    bindings: {
      CHATGPT_API_KEY: "secret",
      LLM_TEST_MODE: "echo",
      OPENAI_MAX_PER_MINUTE: "2",
      ...bindings,
    },
  });
}

async function getStub(mf: Miniflare) {
  const ns: any = await mf.getDurableObjectNamespace("LLM");
  const id = ns.idFromName("test");
  return ns.get(id);
}

describe("OpenAIProviderDO", () => {
  it("echoes messages in test mode", async () => {
    const mf = await createMf();
    const stub: any = await getStub(mf);
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
    const mf = await createMf();
    const stub: any = await getStub(mf);
    try {
      await stub.translate({
        api_key: "wrong",
        messages: [{ role: "user", content: "hi" }],
      });
      throw new Error("expected unauthorized");
    } catch (err: any) {
      expect(String(err)).toContain("unauthorized");
    }
  });

  it("enforces rate limits", async () => {
    const mf = await createMf();
    const stub: any = await getStub(mf);
    await stub.translate({ api_key: "secret", messages: [{ role: "user", content: "1" }] });
    await stub.translate({ api_key: "secret", messages: [{ role: "user", content: "2" }] });
    try {
      await stub.translate({
        api_key: "secret",
        messages: [{ role: "user", content: "3" }],
      });
      throw new Error("expected rate limit");
    } catch (err: any) {
      expect(String(err)).toContain("rate_limited");
    }
  });

  it("requires messages", async () => {
    const mf = await createMf();
    const stub: any = await getStub(mf);
    try {
      await stub.translate({ api_key: "secret", messages: [] as any });
      throw new Error("expected missing messages");
    } catch (err: any) {
      expect(String(err)).toContain("missing messages");
    }
  });
});

