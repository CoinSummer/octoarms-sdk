export type HandlerRequestFn = (
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string,
) => Promise<{ status: number; text: string }>

export type HandlerInvokeInput = {
  handlerName: string
  executionMode?: "sync" | "async"
  source?: Record<string, unknown>
  cursorHint?: Record<string, unknown>
  limits?: Record<string, unknown>
}

export type HandlerJobInput = {
  handlerName: string
  source?: Record<string, unknown>
  cursorHint?: Record<string, unknown>
  limits?: Record<string, unknown>
}

export type HandlerJobStatus = {
  job_id: string
  status: string
  result?: Record<string, unknown>
}

export type HandlerInvokeOutput = {
  status: string
  records: Record<string, unknown>[]
  cursor_hint: Record<string, unknown>
  stats: Record<string, unknown>
  diagnostics: Record<string, unknown>
}

export type TaskHandlerClient = {
  invoke(input: HandlerInvokeInput): Promise<HandlerInvokeOutput>
  submitJob(input: HandlerJobInput): Promise<HandlerJobStatus>
  getJob(jobID: string): Promise<HandlerJobStatus>
}

const normalizeBaseUrl = (raw: string): string => {
  const base = raw.trim()
  if (!base) return ""
  return base.replace(/\/+$/, "")
}

const defaultRequest: HandlerRequestFn = async (url, method, headers, body) => {
  const response = await fetch(url, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(20_000),
  })
  return {
    status: response.status,
    text: await response.text(),
  }
}

const parseJSON = (text: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>
    }
  } catch {
    return {}
  }
  return {}
}

const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export const buildTaskHandlerClient = (
  capabilityEndpoint: string,
  ephemeralToken: string,
  requestFn?: HandlerRequestFn,
): TaskHandlerClient => {
  const baseUrl = normalizeBaseUrl(capabilityEndpoint)
  const token = ephemeralToken.trim()
  const request = requestFn ?? defaultRequest

  const call = async <T>(route: string, payload: Record<string, unknown>): Promise<T> => {
    if (!baseUrl) {
      throw new Error("task handler endpoint is required")
    }
    const endpoint = `${baseUrl}${route}`
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
    const { status, text } = await request(endpoint, "POST", headers, JSON.stringify(payload))
    if (status < 200 || status >= 300) {
      throw new Error(`task handler request failed: http ${status} ${text}`)
    }
    const parsed = parseJSON(text)
    return (parsed.data ?? parsed) as T
  }

  return {
    async invoke(input: HandlerInvokeInput): Promise<HandlerInvokeOutput> {
      const data = await call<Record<string, unknown>>("/api/internal/handlers/invoke", {
        handler_name: input.handlerName,
        execution_mode: input.executionMode ?? "sync",
        source: asObject(input.source),
        cursor_hint: asObject(input.cursorHint),
        limits: asObject(input.limits),
      })
      return {
        status: String(data.status ?? "done"),
        records: Array.isArray(data.records) ? (data.records as Record<string, unknown>[]) : [],
        cursor_hint: asObject(data.cursor_hint),
        stats: asObject(data.stats),
        diagnostics: asObject(data.diagnostics),
      }
    },

    async submitJob(input: HandlerJobInput): Promise<HandlerJobStatus> {
      return {
        job_id: "phase2-not-implemented",
        status: "not_supported",
        result: {
          handler_name: input.handlerName,
          reason: "async jobs are not available in phase 1",
        },
      }
    },

    async getJob(jobID: string): Promise<HandlerJobStatus> {
      return {
        job_id: String(jobID),
        status: "not_supported",
        result: { reason: "async jobs are not available in phase 1" },
      }
    },
  }
}
