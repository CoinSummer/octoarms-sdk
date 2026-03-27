import type { DataUpsertPayload, UpsertFn } from "./context.js"

export type RequestFn = (
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string,
) => Promise<{ status: number; text: string }>

const noopUpsert: UpsertFn = async () => {
  return
}

const normalizeBaseUrl = (raw: string): string => {
  const base = raw.trim()
  if (!base) {
    return ""
  }
  return base.replace(/\/+$/, "")
}

const parseRunId = (raw: unknown): number | undefined => {
  const parsed = Number.parseInt(String(raw), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return undefined
  }
  return parsed
}

const defaultRequest: RequestFn = async (url, method, headers, body) => {
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

export const buildDataApiUpsertFn = (
  capabilityEndpoint: string,
  ephemeralToken: string,
  requestFn?: RequestFn,
): UpsertFn => {
  const baseUrl = normalizeBaseUrl(capabilityEndpoint)
  if (!baseUrl) {
    return noopUpsert
  }

  const token = ephemeralToken.trim()
  const request = requestFn ?? defaultRequest

  return async (payload: DataUpsertPayload): Promise<void> => {
    const endpoint = `${baseUrl}/api/internal/data/datasets/${encodeURIComponent(payload.dataset)}/upsert`

    const audit: Record<string, string | number> = {
      task_name: payload.taskName,
      task_version: payload.taskVersion,
    }

    const runId = parseRunId(payload.runId)
    if (runId !== undefined) {
      audit.run_id = runId
    }

    const body = JSON.stringify({
      rows: payload.rows,
      key_fields: payload.keyFields,
      audit,
    })

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    if (token) {
      headers["X-Ephemeral-Token"] = token
    }

    const { status, text } = await request(endpoint, "POST", headers, body)
    if (status < 200 || status >= 300) {
      throw new Error(`data upsert failed: http ${status} ${text}`)
    }
  }
}
