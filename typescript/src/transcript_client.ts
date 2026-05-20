export type TranscriptRequestFn = (
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string,
) => Promise<{ status: number; text: string }>

export type SubmitTranscriptInput = {
  url: string
  language?: string
  title?: string
  forceRetranscribe?: boolean
}

export type TranscriptClient = {
  submitTranscript(input: SubmitTranscriptInput): Promise<Record<string, unknown>>
  getTranscript(jobId: string): Promise<Record<string, unknown>>
  waitTranscript(jobId: string, options?: { intervalMs?: number; timeoutMs?: number }): Promise<Record<string, unknown>>
}

const normalizeBaseUrl = (raw: string): string => raw.trim().replace(/\/+$/, "")

const parseJSON = (text: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>
  } catch {
    return {}
  }
  return {}
}

const defaultRequest: TranscriptRequestFn = async (url, method, headers, body) => {
  const resp = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(20_000) })
  return { status: resp.status, text: await resp.text() }
}

const sleep = async (ms: number): Promise<void> => await new Promise((resolve) => setTimeout(resolve, ms))

export const buildTranscriptClient = (
  capabilityEndpoint: string,
  ephemeralToken: string,
  requestFn?: TranscriptRequestFn,
): TranscriptClient => {
  const base = normalizeBaseUrl(capabilityEndpoint)
  const token = ephemeralToken.trim()
  const request = requestFn ?? defaultRequest

  const doRequest = async (url: string, method: string, payload?: Record<string, unknown>): Promise<Record<string, unknown>> => {
    if (!base) throw new Error("transcript endpoint is required")
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (token) headers.Authorization = `Bearer ${token}`
    const { status, text } = await request(`${base}${url}`, method, headers, JSON.stringify(payload ?? {}))
    if (status < 200 || status >= 300) throw new Error(`transcript request failed: http ${status} ${text}`)
    const parsed = parseJSON(text)
    return (parsed.data ?? parsed) as Record<string, unknown>
  }

  return {
    submitTranscript: async (input) =>
      await doRequest("/api/external/transcripts", "POST", {
        url: input.url,
        language: (input.language ?? "").trim(),
        title: (input.title ?? "").trim(),
        force_retranscribe: Boolean(input.forceRetranscribe),
      }),
    getTranscript: async (jobId) => await doRequest(`/api/external/transcripts/${encodeURIComponent(jobId)}`, "GET"),
    waitTranscript: async (jobId, options = {}) => {
      const intervalMs = Math.max(200, options.intervalMs ?? 1000)
      const timeoutMs = Math.max(1000, options.timeoutMs ?? 120000)
      const deadline = Date.now() + timeoutMs
      for (;;) {
        const out = await doRequest(`/api/external/transcripts/${encodeURIComponent(jobId)}`, "GET")
        const status = String(out.status ?? "")
        if (status === "completed" || status === "failed" || status === "canceled") return out
        if (Date.now() >= deadline) throw new Error(`wait transcript timeout: ${jobId}`)
        await sleep(intervalMs)
      }
    },
  }
}
