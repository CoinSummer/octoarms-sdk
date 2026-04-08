export type RuntimeRequestFn = (
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string,
) => Promise<{ status: number; text: string }>

export type RuntimeSnapshotSource = Record<string, unknown>

export type ResolveSnapshotInput = {
  snapshotRef: string
  taskName?: string
  runID?: string
}

export type ClaimCursorInput = {
  taskName: string
  sourceID: number
}

export type CommitCursorInput = {
  taskName: string
  sourceID: number
  expectedVersion: number
  cursorJSON: Record<string, unknown>
}

export type EmitRuntimeInput = {
  eventType: string
  taskName: string
  taskVersion: string
  runID: string
  attemptNo: number
  sourceID: number
  payload: Record<string, unknown>
}

export type RuntimeCursorState = {
  cursor_json: Record<string, unknown>
  version: number
} & Record<string, unknown>

export type TaskRuntimeClient = {
  resolveSnapshot(input: ResolveSnapshotInput): Promise<RuntimeSnapshotSource[]>
  claimCursor(input: ClaimCursorInput): Promise<RuntimeCursorState>
  commitCursor(input: CommitCursorInput): Promise<RuntimeCursorState>
  emit(input: EmitRuntimeInput): Promise<void>
}

const normalizeBaseUrl = (raw: string): string => {
  const base = raw.trim()
  if (!base) {
    return ""
  }
  return base.replace(/\/+$/, "")
}

const defaultRequest: RuntimeRequestFn = async (url, method, headers, body) => {
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

const asString = (value: unknown): string => (typeof value === "string" ? value : "")

const asObject = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

export const buildTaskRuntimeClient = (
  capabilityEndpoint: string,
  ephemeralToken: string,
  requestFn?: RuntimeRequestFn,
): TaskRuntimeClient => {
  const baseUrl = normalizeBaseUrl(capabilityEndpoint)
  const token = ephemeralToken.trim()
  const request = requestFn ?? defaultRequest

  const call = async <T>(route: string, payload: Record<string, unknown>): Promise<T> => {
    if (!baseUrl) {
      throw new Error("task runtime endpoint is required")
    }
    const endpoint = `${baseUrl}${route}`
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const { status, text } = await request(endpoint, "POST", headers, JSON.stringify(payload))
    if (status < 200 || status >= 300) {
      throw new Error(`task runtime request failed: http ${status} ${text}`)
    }

    const parsed = parseJSON(text)
    const data = parsed.data
    if (data === undefined) {
      return parsed as T
    }
    return data as T
  }

  return {
    async resolveSnapshot(input: ResolveSnapshotInput): Promise<RuntimeSnapshotSource[]> {
      const data = await call<Record<string, unknown>>("/api/external/task-runtime/snapshot/resolve", {
        snapshot_ref: asString(input.snapshotRef).trim(),
        task_name: asString(input.taskName).trim(),
        run_id: asString(input.runID).trim(),
      })
      const items = data.items
      if (!Array.isArray(items)) {
        return []
      }
      return items.filter((row) => row && typeof row === "object") as RuntimeSnapshotSource[]
    },

    async claimCursor(input: ClaimCursorInput): Promise<RuntimeCursorState> {
      const data = await call<Record<string, unknown>>("/api/external/task-runtime/cursor/claim", {
        task_name: input.taskName,
        source_id: input.sourceID,
      })
      return {
        ...data,
        cursor_json: asObject(data.cursor_json),
        version: Number(data.version ?? 0),
      }
    },

    async commitCursor(input: CommitCursorInput): Promise<RuntimeCursorState> {
      const data = await call<Record<string, unknown>>("/api/external/task-runtime/cursor/commit", {
        task_name: input.taskName,
        source_id: input.sourceID,
        expected_version: input.expectedVersion,
        cursor_json: input.cursorJSON,
      })
      return {
        ...data,
        cursor_json: asObject(data.cursor_json),
        version: Number(data.version ?? 0),
      }
    },

    async emit(input: EmitRuntimeInput): Promise<void> {
      await call("/api/external/task-runtime/emit", {
        event_type: input.eventType,
        task_name: input.taskName,
        task_version: input.taskVersion,
        run_id: input.runID,
        attempt_no: input.attemptNo,
        source_id: input.sourceID,
        payload: input.payload,
      })
    },
  }
}
