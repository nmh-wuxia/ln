// Cloudflare Worker entry that routes to ChapterDO via RPC

import type { DurableObjectNamespace, R2Bucket as CfR2Bucket } from "@cloudflare/workers-types";
import { ChapterDO } from "./chapter";

export interface Env {
  CHAPTER_DO: DurableObjectNamespace;
  BUCKET: CfR2Bucket;
}

type ChapterMethod = "init" | "serialize" | "meta" | "patch" | "text" | "html";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname !== "/rpc/chapter" || request.method.toUpperCase() !== "POST") {
      return new Response("not found", { status: 404 });
    }
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: "invalid JSON" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    const name: string = body?.name;
    const method: ChapterMethod = body?.method;
    const params: any = body?.params;
    if (!name || !method) {
      return new Response(JSON.stringify({ error: "missing name or method" }), {
        status: 400,
        headers: { "content-type": "application/json" },
      });
    }
    const id = env.CHAPTER_DO.idFromName(name);
    const stub = env.CHAPTER_DO.get(id) as unknown as {
      init(input: any): Promise<any>;
      serialize(): Promise<any>;
      meta(): Promise<any>;
      patch(patch: any): Promise<any>;
      text(params?: any): Promise<any>;
      html(params?: any): Promise<any>;
    };

    try {
      let result: unknown;
      switch (method) {
        case "init":
          result = await stub.init(params);
          break;
        case "serialize":
          result = await stub.serialize();
          break;
        case "meta":
          result = await stub.meta();
          break;
        case "patch":
          result = await stub.patch(params);
          break;
        case "text":
          result = await stub.text(params);
          break;
        case "html":
          result = await stub.html(params);
          break;
        default:
          return new Response(JSON.stringify({ error: "unknown method" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
      }
      const json = typeof result === "string" ? { result } : result;
      return new Response(JSON.stringify(json), {
        headers: { "content-type": "application/json" },
      });
    } catch (err: any) {
      return new Response(JSON.stringify({ error: String(err?.message ?? err) }), {
        status: 500,
        headers: { "content-type": "application/json" },
      });
    }
  },
};

// Re-export for Wrangler class binding
export { ChapterDO };
