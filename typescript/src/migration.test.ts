import assert from "node:assert/strict"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { describe, it } from "node:test"

import { migrate } from "./migration"

describe("migrate", () => {
  it("posts declared migration SQL to capability API", async () => {
    const root = mkdtempSync(path.join(tmpdir(), "octoarms-sdk-migrate-"))
    const migrationsDir = path.join(root, "migrations")
    mkdirSync(migrationsDir)
    writeFileSync(path.join(migrationsDir, "20260329_01_init.sql"), "SELECT 1;\n", "utf-8")

    const calls: Array<{ url: string; method: string; headers: Record<string, string>; body: string }> = []
    try {
      const result = await migrate(
        {
          taskName: "defillama_tvl_top10",
          taskVersion: "v0.1.0",
          migrationVersion: "20260329_01_init",
          capabilityEndpoint: "http://capability.local",
          ephemeralToken: "ephemeral-token",
          migrationIndex: { "20260329_01_init": "migrations/20260329_01_init.sql" },
          taskRootDir: root,
        },
        async (url, method, headers, body) => {
          calls.push({ url, method, headers, body })
          return { status: 200, text: '{"code":0,"msg":"success"}' }
        },
      )

      assert.equal(result.status, "success")
      assert.equal(calls.length, 1)
      assert.equal(calls[0]?.url, "http://capability.local/api/internal/capability/migrations/apply")
      assert.equal(calls[0]?.headers["Authorization"], "Bearer ephemeral-token")
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })
})
