import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildTaskHandlerClient } from "./handler_api"

describe("buildTaskHandlerClient", () => {
  it("invokes sync handler and unwraps data", async () => {
    const client = buildTaskHandlerClient("https://scanner", "token", async (url, method, headers, body) => {
      assert.equal(url, "https://scanner/api/internal/handlers/invoke")
      assert.equal(method, "POST")
      assert.equal(headers.Authorization, "Bearer token")
      assert.deepEqual(JSON.parse(body), {
        handler_name: "twitter.list_tweets",
        execution_mode: "sync",
        source: {},
        cursor_hint: {},
        limits: {},
      })
      return {
        status: 200,
        text: JSON.stringify({
          code: 0,
          msg: "success",
          data: { status: "done", records: [{ external_id: "t-1" }], cursor_hint: { since_id: "t-1" }, stats: { processed: 1 }, diagnostics: {} },
        }),
      }
    })

    const out = await client.invoke({ handlerName: "twitter.list_tweets", executionMode: "sync" })
    assert.equal(out.status, "done")
    assert.equal(out.records.length, 1)
  })

  it("returns phase2 placeholder for submitJob/getJob", async () => {
    const client = buildTaskHandlerClient("https://scanner", "token")
    const submit = await client.submitJob({ handlerName: "twitter.list_tweets" })
    const get = await client.getJob("job-1")
    assert.equal(submit.status, "not_supported")
    assert.equal(get.status, "not_supported")
  })
})
