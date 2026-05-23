import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildTranscriptClient } from "./transcript_client"

describe("buildTranscriptClient", () => {
  it("submits transcript and polls", async () => {
    let pollCount = 0
    const client = buildTranscriptClient("https://scanner", "token", async (url, method, headers, body) => {
      assert.equal(headers.Authorization, "Bearer token")
      if (url.endsWith("/api/external/transcripts") && method === "POST") {
        const payload = JSON.parse(body)
        assert.equal(payload.url, "https://example.com/a.mp3")
        assert.deepEqual(payload.metadata, { source: "unit-test" })
        return { status: 200, text: JSON.stringify({ code: 0, data: { job_id: "j1", status: "accepted" } }) }
      }
      if (url.endsWith("/api/external/transcripts/j1") && method === "GET") {
        pollCount += 1
        if (pollCount === 1) return { status: 200, text: JSON.stringify({ code: 0, data: { job_id: "j1", status: "running" } }) }
        return { status: 200, text: JSON.stringify({ code: 0, data: { job_id: "j1", status: "completed", transcript_text: "ok" } }) }
      }
      throw new Error(`unexpected request: ${method} ${url}`)
    })

    const submit = await client.submitTranscript({ url: "https://example.com/a.mp3", language: "en", metadata: { source: "unit-test" } })
    assert.equal(submit.job_id, "j1")
    const out = await client.waitTranscript("j1", { intervalMs: 1, timeoutMs: 5000 })
    assert.equal(out.status, "completed")
  })
})
