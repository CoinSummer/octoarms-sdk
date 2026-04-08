import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildTaskRuntimeClient } from "./runtime_api"

describe("buildTaskRuntimeClient", () => {
  it("resolves snapshot with bearer token and unwraps data", async () => {
    const calls: Array<{ url: string; method: string; headers: Record<string, string>; body: string }> = []
    const client = buildTaskRuntimeClient(" https://scanner.internal/ ", " token-abc ", async (url, method, headers, body) => {
      calls.push({ url, method, headers, body })
      return {
        status: 200,
        text: JSON.stringify({ code: 0, msg: "success", data: { items: [{ source_id: 1, source_key: "main" }] } }),
      }
    })

    const items = await client.resolveSnapshot({ snapshotRef: "snap-1", taskName: "twitter_list_tweets", runID: "1001" })

    assert.deepEqual(items, [{ source_id: 1, source_key: "main" }])
    assert.equal(calls.length, 1)
    assert.equal(calls[0]?.url, "https://scanner.internal/api/internal/task-runtime/snapshot/resolve")
    assert.deepEqual(calls[0]?.headers, {
      "Content-Type": "application/json",
      Authorization: "Bearer token-abc",
    })
  })

  it("commits cursor with expected payload", async () => {
    let body = ""
    const client = buildTaskRuntimeClient("https://scanner.internal", "token", async (_url, _method, _headers, rawBody) => {
      body = rawBody
      return { status: 200, text: JSON.stringify({ code: 0, msg: "success", data: { version: 2 } }) }
    })

    await client.commitCursor({
      taskName: "twitter_list_tweets",
      sourceID: 9,
      expectedVersion: 1,
      cursorJSON: { since_id: "200" },
    })

    assert.deepEqual(JSON.parse(body), {
      task_name: "twitter_list_tweets",
      source_id: 9,
      expected_version: 1,
      cursor_json: { since_id: "200" },
    })
  })

  it("throws when runtime api returns non-2xx", async () => {
    const client = buildTaskRuntimeClient("https://scanner.internal", "token", async () => {
      return { status: 409, text: "conflict" }
    })

    await assert.rejects(
      async () => {
        await client.claimCursor({ taskName: "twitter_list_tweets", sourceID: 1 })
      },
      /task runtime request failed: http 409 conflict/,
    )
  })
})
