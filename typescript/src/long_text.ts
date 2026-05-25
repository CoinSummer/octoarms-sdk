export type TextChunk = {
  chunkId: string
  index: number
  charStart: number
  charEnd: number
  text: string
}

export type EvidenceValidationIssue = {
  code: string
  message: string
  path: string
}

export type SplitTextOptions = {
  targetChars?: number
  overlapChars?: number
  minChunkChars?: number
  chunkIdPrefix?: string
}

export type ValidateEvidenceGraphOptions = {
  sourceText?: string
  insightIdField?: string
  evidenceIdsField?: string
  evidenceIdField?: string
  quoteField?: string
  supportsField?: string
  validateQuotesInSource?: boolean
}

export const splitText = (text: string, options: SplitTextOptions = {}): TextChunk[] => {
  const source = String(text ?? "")
  if (!source) return []
  const targetChars = options.targetChars ?? 18_000
  const overlapChars = options.overlapChars ?? 1_200
  const minChunkChars = options.minChunkChars ?? 1_000
  const chunkIdPrefix = options.chunkIdPrefix ?? "chunk"
  if (targetChars <= 0) throw new Error("targetChars must be > 0")
  if (overlapChars < 0) throw new Error("overlapChars must be >= 0")
  if (overlapChars >= targetChars) throw new Error("overlapChars must be smaller than targetChars")
  if (minChunkChars < 0) throw new Error("minChunkChars must be >= 0")

  const chunks: TextChunk[] = []
  let start = 0
  while (start < source.length) {
    const idealEnd = Math.min(source.length, start + targetChars)
    let end = findChunkEnd(source, start, idealEnd, minChunkChars)
    if (end <= start) end = idealEnd
    const chunkText = source.slice(start, end).trim()
    if (chunkText) {
      chunks.push({
        chunkId: `${chunkIdPrefix}_${String(chunks.length).padStart(4, "0")}`,
        index: chunks.length,
        charStart: start,
        charEnd: end,
        text: chunkText,
      })
    }
    if (end >= source.length) break
    start = Math.max(0, end - overlapChars)
  }
  return chunks
}

export const normalizeQuote = (text: string): string => String(text ?? "").replace(/\s+/g, " ").trim().toLowerCase()

export const compactText = (text: string): string => String(text ?? "").replace(/\s+/g, "").trim().toLowerCase()

export const quoteExistsInText = (quote: string, sourceText: string): boolean => {
  const normalizedQuote = normalizeQuote(quote)
  if (!normalizedQuote) return false
  if (normalizeQuote(sourceText).includes(normalizedQuote)) return true
  const compactQuote = compactText(quote)
  return Boolean(compactQuote && compactText(sourceText).includes(compactQuote))
}

export const validateEvidenceGraph = (
  insights: Array<Record<string, unknown>>,
  evidence: Array<Record<string, unknown>>,
  options: ValidateEvidenceGraphOptions = {},
): EvidenceValidationIssue[] => {
  const insightIdField = options.insightIdField ?? "insight_id"
  const evidenceIdsField = options.evidenceIdsField ?? "evidence_ids"
  const evidenceIdField = options.evidenceIdField ?? "evidence_id"
  const quoteField = options.quoteField ?? "quote"
  const supportsField = options.supportsField ?? "supports"
  const issues: EvidenceValidationIssue[] = []
  const evidenceById = new Map<string, Record<string, unknown>>()

  evidence.forEach((item, index) => {
    const evidenceId = stringValue(item[evidenceIdField])
    const quote = stringValue(item[quoteField])
    const supports = stringList(item[supportsField])
    const path = `evidence[${index}]`
    if (!evidenceId) {
      issues.push({ code: "missing_evidence_id", message: "evidence id is required", path: `${path}.${evidenceIdField}` })
      return
    }
    if (!quote) {
      issues.push({ code: "missing_quote", message: "evidence quote is required", path: `${path}.${quoteField}` })
    } else if (options.validateQuotesInSource && options.sourceText !== undefined && !quoteExistsInText(quote, options.sourceText)) {
      issues.push({ code: "quote_not_in_source", message: "evidence quote was not found in source text", path: `${path}.${quoteField}` })
    }
    if (supports.length === 0) {
      issues.push({ code: "missing_supports", message: "evidence supports are required", path: `${path}.${supportsField}` })
    }
    evidenceById.set(evidenceId, item)
  })

  insights.forEach((insight, index) => {
    const insightId = stringValue(insight[insightIdField])
    const evidenceIds = stringList(insight[evidenceIdsField])
    const path = `insights[${index}]`
    if (!insightId) {
      issues.push({ code: "missing_insight_id", message: "insight id is required", path: `${path}.${insightIdField}` })
    }
    if (evidenceIds.length === 0) {
      issues.push({ code: "missing_evidence_refs", message: "insight evidence refs are required", path: `${path}.${evidenceIdsField}` })
    }
    for (const evidenceId of evidenceIds) {
      const item = evidenceById.get(evidenceId)
      if (!item) {
        issues.push({ code: "dangling_evidence_ref", message: `evidence ref ${evidenceId} does not exist`, path: `${path}.${evidenceIdsField}` })
        continue
      }
      const supports = stringList(item[supportsField])
      if (insightId && !supports.includes(insightId)) {
        issues.push({
          code: "missing_reverse_support",
          message: `evidence ${evidenceId} does not support insight ${insightId}`,
          path: `evidence.${evidenceId}.${supportsField}`,
        })
      }
    }
  })

  return issues
}

export const raiseForEvidenceGraphIssues = (issues: EvidenceValidationIssue[]): void => {
  if (issues.length === 0) return
  const first = issues[0]
  throw new Error(`${first.code} at ${first.path}: ${first.message}`)
}

const findChunkEnd = (text: string, start: number, idealEnd: number, minChunkChars: number): number => {
  if (idealEnd >= text.length) return text.length
  const minEnd = Math.min(text.length, start + minChunkChars)
  const search = text.slice(minEnd, idealEnd)
  for (const pattern of ["\n\n", "\n", ". ", "? ", "! ", "。", "？", "！"]) {
    const offset = search.lastIndexOf(pattern)
    if (offset >= 0) return minEnd + offset + pattern.length
  }
  return idealEnd
}

const stringValue = (value: unknown): string => String(value ?? "").trim()

const stringList = (value: unknown): string[] => {
  if (!Array.isArray(value)) return []
  return value.map((item) => stringValue(item)).filter((item) => item.length > 0)
}
