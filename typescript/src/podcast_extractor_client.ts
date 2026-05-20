export type PodcastDiscoverInput = {
  platform: string
  sourceUrl: string
  publishedAfter?: string
  limit?: number
}

export type PodcastExtractInput = {
  platform: string
  episodeUrl: string
}

export type PodcastExtractorRequestFn = (
  url: string,
  method: string,
  headers: Record<string, string>,
  body: string,
) => Promise<{ status: number; text: string }>

export type PodcastExtractorClient = {
  discoverEpisodes(input: PodcastDiscoverInput): Promise<Record<string, unknown>>
  extractAudio(input: PodcastExtractInput): Promise<Record<string, unknown>>
}

const normalizeBaseUrl = (raw: string): string => raw.trim().replace(/\/+$/, "")

const defaultRequest: PodcastExtractorRequestFn = async (url, method, headers, body) => {
  const resp = await fetch(url, { method, headers, body, signal: AbortSignal.timeout(20_000) })
  return { status: resp.status, text: await resp.text() }
}

const parseJSON = (text: string): Record<string, unknown> => {
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>
  } catch {
    return {}
  }
  return {}
}

export const buildPodcastExtractorClient = (
  capabilityEndpoint: string,
  ephemeralToken: string,
  requestFn?: PodcastExtractorRequestFn,
): PodcastExtractorClient => {
  const base = normalizeBaseUrl(capabilityEndpoint)
  const token = ephemeralToken.trim()
  const request = requestFn ?? defaultRequest

  const post = async (route: string, payload: Record<string, unknown>): Promise<Record<string, unknown>> => {
    if (!base) throw new Error("podcast extractor endpoint is required")
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (token) headers.Authorization = `Bearer ${token}`
    const { status, text } = await request(`${base}${route}`, "POST", headers, JSON.stringify(payload))
    if (status < 200 || status >= 300) throw new Error(`podcast extractor request failed: http ${status} ${text}`)
    const parsed = parseJSON(text)
    return (parsed.data ?? parsed) as Record<string, unknown>
  }

  return {
    discoverEpisodes: async (input) =>
      await post("/api/internal/podcasts/discover", {
        platform: input.platform,
        source_url: input.sourceUrl,
        published_after: (input.publishedAfter ?? "").trim(),
        limit: input.limit ?? 0,
      }),
    extractAudio: async (input) =>
      await post("/api/internal/podcasts/extract", {
        platform: input.platform,
        episode_url: input.episodeUrl,
      }),
  }
}
