Cloudflare Durable Object: ChapterDO

Overview

- Implements a self-contained Durable Object (`ChapterDO`) that replicates the functionality of `src/chapter.ts` directly inside the DO (no import of `Chapter`).
- Uses the real Cloudflare R2 bucket via the `env.BUCKET` binding (typed with `@cloudflare/workers-types`).
- Persists chapter metadata/state in Durable Object SQLite storage (`state.storage.sql`) under a single-row table; chapter text and rendered HTML live in R2.
- Exposes RPC methods (Cloudflare RPC) instead of HTTP paths.

Bindings (wrangler.toml)

```
name = "lightnovel"
main = "src/do/worker.ts"
compatibility_date = "2024-08-01"
workers_dev = true

[[durable_objects.bindings]]
name = "CHAPTER_DO"
class_name = "ChapterDO"

[[migrations]]
tag = "v1"
new_classes = ["ChapterDO"]

[[r2_buckets]]
binding = "BUCKET"
bucket_name = "<your-r2-bucket-name>"
```

RPC Routing

- The Worker entry `src/do/worker.ts` exposes a single endpoint using DO RPC:
  - `POST /rpc/chapter` with JSON body `{ name, method, params }`.
  - `name` is the Durable Object name, typically `story:chapter` (URL-encode if needed when your client constructs the URL, but name is passed inside JSON here).
  - `method` is one of: `init | serialize | meta | patch | text | html`.
  - `params` matches the method signature (see below).

Example Requests (cURL)

- Initialize:
  ```sh
  curl -X POST http://127.0.0.1:8787/rpc/chapter \
    -H 'content-type: application/json' \
    -d '{
          "name": "story:chapter",
          "method": "init",
          "params": {
            "story_title": "story",
            "chapter_title": "chapter",
            "when_free": 0,
            "cost": 0,
            "text": "Hello world"
          }
        }'
  ```

- Metadata:
  ```sh
  curl -X POST http://127.0.0.1:8787/rpc/chapter \
    -H 'content-type: application/json' \
    -d '{ "name": "story:chapter", "method": "meta" }'
  ```

- Serialized state:
  ```sh
  curl -X POST http://127.0.0.1:8787/rpc/chapter \
    -H 'content-type: application/json' \
    -d '{ "name": "story:chapter", "method": "serialize" }'
  ```

- Apply a patch:
  ```sh
  curl -X POST http://127.0.0.1:8787/rpc/chapter \
    -H 'content-type: application/json' \
    -d '{
          "name": "story:chapter",
          "method": "patch",
          "params": { "id": "p1", "start": 0, "end": 5 }
        }'
  ```

- Fetch text or HTML for a version (defaults to latest when omitted):
  ```sh
  curl -X POST http://127.0.0.1:8787/rpc/chapter \
    -H 'content-type: application/json' \
    -d '{ "name": "story:chapter", "method": "text", "params": { "version": 0 } }'

  curl -X POST http://127.0.0.1:8787/rpc/chapter \
    -H 'content-type: application/json' \
    -d '{ "name": "story:chapter", "method": "html", "params": { "version": 0 } }'
  ```

Durable Object Methods

- `init(params)` -> `{ ok, title, version } | { error }`
  - Params: `{ story_title, chapter_title, when_free?, cost?, text }`.
  - Initializes a new chapter, writes text and HTML render to R2, and persists state in DO storage.
- `serialize()` -> `string | { error }`
  - Serialized chapter JSON (includes versioned text history).
- `meta()` -> `{ story_title, chapter_title, title, when_free, cost, version, last_synced_version, patch_groups } | { error }`
- `patch({ id, start, end })` -> `{ ok, patch_groups } | { error }`
- `text({ version? })` -> `string | { error }`
- `html({ version? })` -> `string | { error }`

Error semantics

- `text({ version })` and `html({ version })` validate that `version` is an integer in `[0, versionCount-1]`.
- If the version is out of range, returns `{ error: "invalid version" }` (user error).
- If the version is valid but the R2 object is missing, returns `{ error: "server error: missing content" }` (server-side issue).

Notes

- The project declares `@cloudflare/workers-types` in `package.json` and `tsconfig.json` for accurate Worker/DO, R2, and SQL storage typings.
- `ChapterDO` gates initialization with `state.blockConcurrencyWhile()` in the constructor, then prepares its SQLite schema, so all RPCs run after persisted state is loaded.
- Invariant: if `last_synced_version >= 1`, the corresponding R2 objects exist for all versions `0..last_synced_version-1` because `init()` (and any future content updates) write to R2 synchronously before persisting state. Therefore, `load()` does not attempt any backfill; if an R2 object is missing later, calls that need it will error, signaling data drift.
- DO SQLite storage contains only chapter metadata/state; text and HTML live in R2.
