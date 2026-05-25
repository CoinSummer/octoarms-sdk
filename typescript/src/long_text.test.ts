import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { quoteExistsInText, raiseForEvidenceGraphIssues, splitText, validateEvidenceGraph } from "./long_text"

describe("long text helpers", () => {
  it("splits text with source ranges and overlap", () => {
    const text = Array.from({ length: 10 }, (_, index) => `paragraph ${index} ${"x".repeat(200)}`).join("\n\n")

    const chunks = splitText(text, { targetChars: 700, overlapChars: 100, minChunkChars: 300 })

    assert.ok(chunks.length > 1)
    assert.equal(chunks[0].chunkId, "chunk_0000")
    assert.equal(chunks[0].index, 0)
    assert.equal(chunks[0].charStart, 0)
    assert.ok(chunks[0].charEnd < text.length)
    assert.ok(chunks[1].charStart < chunks[0].charEnd)
    assert.equal(chunks[0].text, text.slice(chunks[0].charStart, chunks[0].charEnd).trim())
  })

  it("rejects invalid overlap", () => {
    assert.throws(() => splitText("hello", { targetChars: 10, overlapChars: 10 }), /overlapChars/)
  })

  it("normalizes whitespace and case when checking quotes", () => {
    const source = "AI factories are\nbecoming a NEW industrial foundation."

    assert.equal(quoteExistsInText("ai factories are becoming a new industrial foundation", source), true)
  })

  it("accepts consistent evidence refs", () => {
    const issues = validateEvidenceGraph(
      [{ insight_id: "ins_1", evidence_ids: ["ev_1"] }],
      [{ evidence_id: "ev_1", quote: "AI factories", supports: ["ins_1"] }],
      { sourceText: "Jensen said AI factories are industrial infrastructure.", validateQuotesInSource: true },
    )

    assert.deepEqual(issues, [])
  })

  it("reports dangling refs and missing reverse support", () => {
    const issues = validateEvidenceGraph(
      [{ insight_id: "ins_1", evidence_ids: ["ev_1", "ev_missing"] }],
      [{ evidence_id: "ev_1", quote: "AI factories", supports: ["other"] }],
    )

    assert.deepEqual(
      issues.map((issue) => issue.code),
      ["missing_reverse_support", "dangling_evidence_ref"],
    )
    assert.throws(() => raiseForEvidenceGraphIssues(issues), /missing_reverse_support/)
  })

  it("reports quote not found in source", () => {
    const issues = validateEvidenceGraph(
      [{ insight_id: "ins_1", evidence_ids: ["ev_1"] }],
      [{ evidence_id: "ev_1", quote: "not present", supports: ["ins_1"] }],
      { sourceText: "AI factories are present.", validateQuotesInSource: true },
    )

    assert.equal(issues[0].code, "quote_not_in_source")
  })
})
