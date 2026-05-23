export type OssUploadRequestFn = (
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string,
) => Promise<{ status: number; text: string }>

export type UploadObjectInput = {
  bucket?: string
  objectKey: string
  contentBase64: string
  contentType?: string
  metadata?: Record<string, unknown>
}

export type UploadObjectBytesInput = {
  bucket?: string
  objectKey: string
  content: Uint8Array
  contentType?: string
  metadata?: Record<string, unknown>
}

export type OssUploadClient = {
  uploadObject(input: UploadObjectInput): Promise<Record<string, unknown>>
  uploadObjectBytes(input: UploadObjectBytesInput): Promise<Record<string, unknown>>
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

const encodeBase64 = (content: Uint8Array): string => Buffer.from(content).toString("base64")

const defaultRequest: OssUploadRequestFn = async (url, method, headers, body) => {
  const resp = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(60_000) })
  return { status: resp.status, text: await resp.text() }
}

export const buildOssUploadClient = (
  capabilityEndpoint: string,
  ephemeralToken: string,
  requestFn?: OssUploadRequestFn,
): OssUploadClient => {
  const base = normalizeBaseUrl(capabilityEndpoint)
  const token = ephemeralToken.trim()
  const request = requestFn ?? defaultRequest

  const uploadObject = async (input: UploadObjectInput): Promise<Record<string, unknown>> => {
    if (!base) throw new Error("oss upload endpoint is required")
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (token) headers.Authorization = `Bearer ${token}`

    const payload = {
      bucket: input.bucket,
      object_key: input.objectKey,
      content_base64: input.contentBase64,
      content_type: (input.contentType ?? "").trim(),
      metadata: input.metadata ?? {},
    }
    const { status, text } = await request(`${base}/api/external/oss/uploads`, "POST", headers, JSON.stringify(payload))
    if (status < 200 || status >= 300) throw new Error(`oss upload request failed: http ${status} ${text}`)
    const parsed = parseJSON(text)
    return (parsed.data ?? parsed) as Record<string, unknown>
  }

  return {
    uploadObject,
    uploadObjectBytes: async (input) =>
      await uploadObject({
        bucket: input.bucket,
        objectKey: input.objectKey,
        contentBase64: encodeBase64(input.content),
        contentType: input.contentType,
        metadata: input.metadata,
      }),
  }
}
