// Expects an R2 bucket binding named `BUCKET` in the Worker environment.
import type { DurableObjectState, R2Bucket } from "@cloudflare/workers-types";
import { DurableObject } from "cloudflare:workers";
import { marked } from "marked";
import { PatchManager } from "~/patch";
import type { Patch, PatchConflictGroup } from "~/patch";

// Durable Object storage uses SQLite via `this.state.storage.sql`.
// We store metadata in a single-row table; content remains in R2.

export interface Env {
  BUCKET: R2Bucket;
}

export class ChapterDO extends DurableObject {
  state: DurableObjectState;
  env: Env;
  story_title: string | null = null;
  chapter_title: string | null = null;
  title: string | null = null;
  when_free = 0;
  cost = 0;
  version = 0; // count of versions; current latest is version-1
  last_synced_version = 0;
  patch_groups: PatchConflictGroup[] = [];

  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.state = state;
    this.env = env;
    // Load persisted state before serving any RPCs
    this.state.blockConcurrencyWhile(async () => {
      await this.ensureSchema();
      await this.load();
    });
  }

  private key(version: number): string {
    if (!this.title) throw new Error("chapter not initialized");
    return `${this.title}:${version}`;
  }

  private async renderAndPut(version: number, text: string) {
    await this.env.BUCKET.put(this.key(version), text);
    await this.env.BUCKET.put(
      `${this.key(version)}.html`,
      marked.parse(text, { async: false }),
    );
  }

  private async ensureSchema() {
    this.state.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS chapter_meta (
        id INTEGER PRIMARY KEY,
        story_title TEXT,
        chapter_title TEXT,
        when_free INTEGER,
        cost INTEGER,
        version INTEGER,
        last_synced_version INTEGER,
        patch_groups TEXT
      )`,
    );
  }

  private async load() {
    const row = this.state.storage.sql
      .exec<{
        story_title: string | null;
        chapter_title: string | null;
        when_free: number | null;
        cost: number | null;
        version: number | null;
        last_synced_version: number | null;
        patch_groups: string | null;
      }>(
        `SELECT story_title, chapter_title, when_free, cost, version, last_synced_version, patch_groups
         FROM chapter_meta WHERE id = 1`,
      )
      .toArray()[0];
    if (!row) return;
    this.story_title = row.story_title ?? null;
    this.chapter_title = row.chapter_title ?? null;
    this.title =
      this.story_title && this.chapter_title
        ? `${this.story_title}:${this.chapter_title}`
        : null;
    this.when_free = row.when_free ?? 0;
    this.cost = row.cost ?? 0;
    this.version = row.version ?? 0;
    this.last_synced_version = row.last_synced_version ?? this.version;
    this.patch_groups = row.patch_groups ? JSON.parse(row.patch_groups) : [];
    // Trust last_synced_version: if version >= 1, content must be present in R2.
  }

  private async serializeState(): Promise<string> {
    const saved_state: any = {
      story_title: this.story_title,
      chapter_title: this.chapter_title,
      when_free: this.when_free,
      cost: this.cost,
      version: this.version,
      last_synced_version: this.last_synced_version,
      patch_groups: this.patch_groups,
    };
    if (this.version === 0) return JSON.stringify(saved_state);
    for (let i = 0; i < this.version - 1; ++i) {
      const obj = await this.env.BUCKET.get(this.key(i));
      if (!obj) throw new Error(`missing text for ${this.key(i)}`);
      saved_state[i] = await obj.text();
    }
    const latestObj = await this.env.BUCKET.get(this.key(this.version - 1));
    if (!latestObj)
      throw new Error(`missing text for ${this.key(this.version - 1)}`);
    const latestText = await latestObj.text();
    saved_state[this.version - 1] = latestText;
    saved_state[this.version] = latestText;
    return JSON.stringify(saved_state);
  }

  private async save() {
    const patchGroupsJson = JSON.stringify(this.patch_groups ?? []);
    const res = this.state.storage.sql.exec(
      `UPDATE chapter_meta
         SET story_title = ?,
             chapter_title = ?,
             when_free = ?,
             cost = ?,
             version = ?,
             last_synced_version = ?,
             patch_groups = ?
       WHERE id = 1`,
      this.story_title,
      this.chapter_title,
      this.when_free,
      this.cost,
      this.version,
      this.last_synced_version,
      patchGroupsJson,
    );
    if (res.rowsWritten === 0) {
      // Best-effort revert and clear any partial state
      this.state.storage.sql.exec(`DELETE FROM chapter_meta WHERE id = 1`);
      throw new Error("save() called before init()");
    }
  }

  async fetch(_request: Request): Promise<Response> {
    return new Response("Use RPC methods on ChapterDO", { status: 404 });
  }

  // Client facing
  async init(input: {
    story_title: string;
    chapter_title: string;
    when_free?: number;
    cost?: number;
    text: string;
  }): Promise<
    { ok: true; title: string; version: number } | { error: string }
  > {
    const { story_title, chapter_title, when_free, cost, text } =
      input ?? ({} as any);
    if (
      !story_title ||
      !chapter_title ||
      typeof text !== "string" ||
      text.length === 0
    ) {
      return { error: "missing story_title, chapter_title, or non-empty text" };
    }

    // Defensive: ensure DB is empty for id=1
    const existing = this.state.storage.sql
      .exec<{ one: number }>(`SELECT 1 as one FROM chapter_meta WHERE id = 1`)
      .toArray();
    if (existing.length > 0) return { error: "chapter already initialized" };

    if (this.title) return { error: "chapter already initialized" };

    this.story_title = story_title;
    this.chapter_title = chapter_title;
    this.title = `${story_title}:${chapter_title}`;
    this.when_free = typeof when_free === "number" ? when_free : 0;
    this.cost = typeof cost === "number" ? cost : 0;
    this.version = 1;
    this.last_synced_version = 1;
    this.patch_groups = [];

    await this.renderAndPut(0, text);
    // First-time persistence: insert single metadata row
    this.state.storage.sql.exec(
      `INSERT INTO chapter_meta
         (id, story_title, chapter_title, when_free, cost, version, last_synced_version, patch_groups)
       VALUES (1, ?, ?, ?, ?, ?, ?, ?)`,
      this.story_title,
      this.chapter_title,
      this.when_free,
      this.cost,
      this.version,
      this.last_synced_version,
      JSON.stringify(this.patch_groups),
    );
    return { ok: true, title: this.title, version: this.version };
  }

  // DEBUG
  async serialize(): Promise<string | { error: string }> {
    if (!this.title) return { error: "not found" };
    return this.serializeState();
  }

  // DEBUG
  async meta(): Promise<
    | {
        story_title: string;
        chapter_title: string;
        title: string;
        when_free: number;
        cost: number;
        version: number;
        last_synced_version: number;
        patch_groups: any;
      }
    | { error: string }
  > {
    if (!this.title || !this.story_title || !this.chapter_title)
      return { error: "not found" };
    return {
      story_title: this.story_title,
      chapter_title: this.chapter_title,
      title: this.title,
      when_free: this.when_free,
      cost: this.cost,
      version: this.version,
      last_synced_version: this.last_synced_version,
      patch_groups: this.patch_groups,
    };
  }

  // Client facing
  // apply a patch to modify chapter text.
  async patch(
    patch: Patch,
  ): Promise<{ ok: true; patch_groups: any } | { error: string }> {
    if (!this.title) return { error: "not found" };
    if (
      !patch ||
      typeof patch.start !== "number" ||
      typeof patch.end !== "number"
    ) {
      return { error: "invalid patch" };
    }
    const pm = new PatchManager();
    pm.groups = this.patch_groups;
    pm.add(patch);
    this.patch_groups = pm.groups;
    await this.save();
    return { ok: true, patch_groups: this.patch_groups };
  }

  // DEBUG
  async text(params?: {
    version?: number;
  }): Promise<string | { error: string }> {
    if (!this.title) return { error: "not found" };
    const version = params?.version ?? this.version - 1;
    const isInt = Number.isFinite(version) && Math.floor(version) === version;
    if (!isInt || version < 0 || version >= this.version) {
      return { error: "invalid version" };
    }
    const obj = await this.env.BUCKET.get(this.key(version));
    if (!obj) return { error: "server error: missing content" };
    return obj.text();
  }

  // DEBUG
  async html(params?: {
    version?: number;
  }): Promise<string | { error: string }> {
    if (!this.title) return { error: "not found" };
    const version = params?.version ?? this.version - 1;
    const isInt = Number.isFinite(version) && Math.floor(version) === version;
    if (!isInt || version < 0 || version >= this.version) {
      return { error: "invalid version" };
    }
    const obj = await this.env.BUCKET.get(`${this.key(version)}.html`);
    if (!obj) return { error: "server error: missing content" };
    return obj.text();
  }
}
