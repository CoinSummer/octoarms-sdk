import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { CollectorContext } from "./context"

describe("CollectorContext", () => {
  it("emits record/checkpoint contract", () => {
    const events: unknown[] = []
    const ctx = new CollectorContext({
      runId: "run-1",
      taskName: "defillama-tvl-top10",
      taskVersion: "v1",
      attemptNo: 1,
      eventSink: (event) => {
        events.push(event)
      },
    })

    ctx.emit("defillama.tvl_top10", { rank: 1, protocol: "Lido" })
    ctx.checkpoint({ cursor: "2026-03-24T00:00:00Z" })

    assert.deepEqual(events, [
      {
        runId: "run-1",
        taskName: "defillama-tvl-top10",
        taskVersion: "v1",
        attemptNo: 1,
        seq: 1,
        eventType: "record",
        payload: {
          schema: "defillama.tvl_top10",
          record: { rank: 1, protocol: "Lido" },
        },
      },
      {
        runId: "run-1",
        taskName: "defillama-tvl-top10",
        taskVersion: "v1",
        attemptNo: 1,
        seq: 2,
        eventType: "checkpoint",
        payload: {
          data: { cursor: "2026-03-24T00:00:00Z" },
        },
      },
    ])
  })

  it("maps upsert/query payload with run metadata", async () => {
    const upserts: unknown[] = []
    const queries: unknown[] = []

    const ctx = new CollectorContext({
      runId: "run-2",
      taskName: "defillama-tvl-top10",
      taskVersion: "v1",
      attemptNo: 2,
      upsertFn: async (payload) => {
        upserts.push(payload)
      },
      queryFn: async (payload) => {
        queries.push(payload)
        return [{ protocol: "Lido", tvl: 32000000000 }]
      },
    })

    await ctx.upsert("defillama_tvl_top10", [{ protocol: "Lido", tvl: 32000000000 }], ["protocol"])
    const rows = await ctx.query("defillama_tvl_top10", ["protocol", "tvl"], { protocol: "Lido" }, 1)

    assert.deepEqual(rows, [{ protocol: "Lido", tvl: 32000000000 }])
    assert.deepEqual(upserts, [
      {
        runId: "run-2",
        taskName: "defillama-tvl-top10",
        taskVersion: "v1",
        attemptNo: 2,
        dataset: "defillama_tvl_top10",
        rows: [{ protocol: "Lido", tvl: 32000000000 }],
        keyFields: ["protocol"],
      },
    ])
    assert.deepEqual(queries, [
      {
        runId: "run-2",
        taskName: "defillama-tvl-top10",
        taskVersion: "v1",
        attemptNo: 2,
        dataset: "defillama_tvl_top10",
        fields: ["protocol", "tvl"],
        filters: { protocol: "Lido" },
        limit: 1,
      },
    ])
  })

  it("forwards log/metric events and capability lookups", () => {
    const events: unknown[] = []
    const capabilities: string[] = []

    const ctx = new CollectorContext({
      runId: "run-3",
      taskName: "defillama-tvl-top10",
      taskVersion: "v1",
      attemptNo: 3,
      eventSink: (event) => {
        events.push(event)
      },
      capabilityProvider: (name) => {
        capabilities.push(name)
        return { name }
      },
    })

    ctx.log("info", "hello", { k: "v" })
    ctx.metric("collector.records", 2, { dataset: "defillama_tvl_top10" })

    const capLookup = ctx.cap() as (name: string) => unknown
    assert.equal(typeof capLookup, "function")
    assert.deepEqual(capLookup("zero-arg"), { name: "zero-arg" })

    assert.deepEqual(ctx.capability("http"), { name: "http" })
    assert.deepEqual(ctx.cap("storage"), { name: "storage" })
    assert.deepEqual(capabilities, ["zero-arg", "http", "storage"])

    assert.deepEqual(events, [
      {
        runId: "run-3",
        taskName: "defillama-tvl-top10",
        taskVersion: "v1",
        attemptNo: 3,
        seq: 1,
        eventType: "log",
        payload: {
          level: "info",
          msg: "hello",
          fields: { k: "v" },
        },
      },
      {
        runId: "run-3",
        taskName: "defillama-tvl-top10",
        taskVersion: "v1",
        attemptNo: 3,
        seq: 2,
        eventType: "metric",
        payload: {
          name: "collector.records",
          value: 2,
          tags: { dataset: "defillama_tvl_top10" },
        },
      },
    ])
  })
})
