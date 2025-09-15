import type { DurableObjectState } from "@cloudflare/workers-types";
import { DurableObject } from "cloudflare:workers";

export interface Env {
  LLM_MAX_PER_MINUTE?: string;
  OPENAI_MAX_PER_MINUTE?: string;
  DEEPSEEK_MAX_PER_MINUTE?: string;
  // Optional per-provider client keys; falls back to LLM_PROVIDER_API_KEY
  LLM_PROVIDER_API_KEY?: string;
  OPENAI_CLIENT_API_KEY?: string;
  DEEPSEEK_CLIENT_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
  CHATGPT_API_KEY?: string;
  // Test helper: when set to 'echo', translate() returns a JSON string with model/messages
  // instead of calling upstream. Useful for deterministic unit tests without network.
  LLM_TEST_MODE?: string;
}

export type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: any;
};

type TranslateParams = {
  api_key: string;
  messages: ChatMessage[];
  model?: string; // override allowed
};

abstract class BaseProviderDO extends DurableObject {
  protected state: DurableObjectState;
  protected env: Env;
  protected windowStart = 0;
  protected count = 0;
  protected endpoint: string;
  protected defaultModel: string;
  protected providerAuth: string; // provider upstream key (required)
  protected maxPerMinute: number; // rate limit

  constructor(
    state: DurableObjectState,
    env: Env,
    endpoint: string,
    defaultModel: string,
    providerAuth: string | undefined,
    rpm: number | undefined,
  ) {
    super(state, env);
    this.state = state;
    this.env = env;
    this.endpoint = endpoint;
    this.defaultModel = defaultModel;
    if (!providerAuth) {
      throw new Error("missing upstream key");
    }
    this.providerAuth = providerAuth;
    const parsed = typeof rpm === "number" && rpm > 0 ? Math.floor(rpm) : NaN;
    if (Number.isFinite(parsed)) {
      this.maxPerMinute = parsed as number;
    } else {
      this.maxPerMinute = 60;
    }
  }

  protected limitPerMinute(): number {
    return this.maxPerMinute;
  }

  async translate(params: TranslateParams): Promise<string> {
    // Per-call client auth (if clientKey configured)
    if (params.api_key !== this.providerAuth) {
      const err: any = new Error("unauthorized");
      err.code = 401;
      throw err;
    }
    // Fixed-window rate limiting
    const now = Date.now();
    const windowMs = 60_000;
    if (now - this.windowStart >= windowMs) {
      this.windowStart = now;
      this.count = 0;
    }
    const max = this.limitPerMinute();
    if (this.count >= max) {
      const resetSec = Math.ceil((this.windowStart + windowMs - now) / 1000);
      const err: any = new Error("rate_limited");
      err.code = 429;
      err.retry_after = Math.max(0, resetSec);
      throw err;
    }
    this.count += 1;

    // Validate params and normalize messages
    if (!Array.isArray(params.messages) || params.messages.length === 0) {
      const err: any = new Error("missing messages array");
      err.code = 400;
      throw err;
    }
    const model = (params.model || this.defaultModel).trim();
    const messages = params.messages.map((m: any) => ({
      role: (m && typeof m.role === "string"
        ? m.role
        : "user") as ChatMessage["role"],
      content:
        m && typeof m.content === "string"
          ? m.content
          : JSON.stringify(m?.content ?? ""),
    }));

    // Test mode short-circuit
    if (this.env.LLM_TEST_MODE === "echo") {
      return JSON.stringify({ model, messages });
    }

    // Upstream call
    const body = { model, stream: false, messages };
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${this.providerAuth}`,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`upstream ${res.status}: ${text}`);
    }
    const data: any = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      const err: any = new Error("no content");
      err.code = 502;
      throw err;
    }
    return content;
  }
}

export class DeepseekProviderDO extends BaseProviderDO {
  constructor(state: DurableObjectState, env: Env) {
    super(
      state,
      env,
      "https://api.deepseek.com/chat/completions",
      "deepseek-chat",
      env.DEEPSEEK_API_KEY,
      env.DEEPSEEK_MAX_PER_MINUTE
        ? Number(env.DEEPSEEK_MAX_PER_MINUTE)
        : undefined,
    );
  }
}

export class OpenAIProviderDO extends BaseProviderDO {
  constructor(state: DurableObjectState, env: Env) {
    super(
      state,
      env,
      "https://api.openai.com/v1/chat/completions",
      "gpt-5-mini",
      env.CHATGPT_API_KEY,
      env.OPENAI_MAX_PER_MINUTE ? Number(env.OPENAI_MAX_PER_MINUTE) : undefined,
    );
  }
}
