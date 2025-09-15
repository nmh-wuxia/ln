import { defineConfig } from "vitest/config";
import { defineWorkersProject } from "@cloudflare/vitest-pool-workers/config";
import { fileURLToPath } from "node:url";

const alias = {
  "~": fileURLToPath(new URL("./src", import.meta.url)),
  "@": fileURLToPath(new URL("./src", import.meta.url)),
};

export default defineConfig({
  resolve: { alias },
  test: {
    coverage: {
      provider: "istanbul",
      include: ["src/**/*.{js,ts,jsx,tsx}"],
    },
    projects: [
      {
        resolve: { alias },
        test: {
          include: ["tests/**/*.{test,spec}.{ts,tsx}"],
        },
      },
      defineWorkersProject({
        resolve: { alias },
        test: {
          include: ["cf-tests/**/*.{test,spec}.{ts,tsx}"],
          pool: "@cloudflare/vitest-pool-workers",
         poolOptions: {
            workers: {
              main: fileURLToPath(new URL("./src/do/worker.ts", import.meta.url)),
              wrangler: {
                configPath: fileURLToPath(new URL("./wrangler.toml", import.meta.url)),
              },
              miniflare: {
                compatibilityDate: "2024-08-01",
                bindings: {
                  CHATGPT_API_KEY: "secret",
                  LLM_TEST_MODE: "echo",
                  OPENAI_MAX_PER_MINUTE: "2",
                },
              },
              isolatedStorage: false,
            },
          },
        },
      }),
    ],
  },
});
