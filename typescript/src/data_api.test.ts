import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildDataApiUpsertFn } from "./data_api"

describe("buildDataApiUpsertFn", () => {
  it("returns noop when capability endpoint is empty", async () => {
    let called = false
    const upsert = buildDataApiUpsertFn("   ", "token", async () => {
      called = true
      return { status: 200, text: "ok" }
    })

    await upsert({
      runId: "123",
      taskName: "demo_task",
      taskVersion: "v0.1.0",
      attemptNo: 1,
      dataset: "demo_dataset",
      rows: [{ id: "1" }],
      keyFields: ["id"],
    })

    assert.equal(called, false)
  })

  it("builds scanner upsert request with encoded dataset and audit run_id", async () => {
    const requests: Array<{ url: string; method: string; headers: Record<string, string>; body: string }> = []
    const upsert = buildDataApiUpsertFn(" https://scanner.internal/ ", "  ephemeral-token  ", async (url, method, headers, body) => {
      requests.push({ url, method, headers, body })
      return { status: 200, text: "ok" }
    })

    await upsert({
      runId: "42",
      taskName: "demo_task",
      taskVersion: "v0.1.0",
      attemptNo: 1,
      dataset: "space name/ok",
      rows: [{ id: "1", foo: "bar" }],
      keyFields: ["id"],
    })

    assert.equal(requests.length, 1)
    assert.deepEqual(requests[0], {
      url: "https://scanner.internal/api/internal/data/datasets/space%20name%2Fok/upsert",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Ephemeral-Token": "ephemeral-token",
      },
      body: JSON.stringify({
        rows: [{ id: "1", foo: "bar" }],
        key_fields: ["id"],
        audit: {
          task_name: "demo_task",
          task_version: "v0.1.0",
          run_id: 42,
        },
      }),
    })
  })

  it("omits audit run_id when runId is invalid and omits token when blank", async () => {
    const requests: Array<{ headers: Record<string, string>; body: string }> = []
    const upsert = buildDataApiUpsertFn("https://scanner.internal", "   ", async (_url, _method, headers, body) => {
      requests.push({ headers, body })
      return { status: 200, text: "ok" }
    })

    await upsert({
      runId: "run-abc",
      taskName: "demo_task",
      taskVersion: "v0.1.0",
      attemptNo: 1,
      dataset: "demo_dataset",
      rows: [{ id: "1" }],
      keyFields: ["id"],
    })

    assert.deepEqual(requests[0]?.headers, {
      "Content-Type": "application/json",
    })
    assert.deepEqual(JSON.parse(requests[0]?.body ?? "{}"), {
      rows: [{ id: "1" }],
      key_fields: ["id"],
      audit: {
        task_name: "demo_task",
        task_version: "v0.1.0",
      },
    })
  })

  it("throws when scanner API responds with non-2xx", async () => {
    const upsert = buildDataApiUpsertFn("https://scanner.internal", "token", async () => {
      return { status: 500, text: "boom" }
    })

    await assert.rejects(
      async () => {
        await upsert({
          runId: "123",
          taskName: "demo_task",
          taskVersion: "v0.1.0",
          attemptNo: 1,
          dataset: "demo_dataset",
          rows: [{ id: "1" }],
          keyFields: ["id"],
        })
      },
      /data upsert failed: http 500 boom/,
    )
  })
})
