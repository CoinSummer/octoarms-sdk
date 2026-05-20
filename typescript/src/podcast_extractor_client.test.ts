import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildPodcastExtractorClient } from "./podcast_extractor_client"

describe("buildPodcastExtractorClient", () => {
  it("calls discover endpoint", async () => {
    const client = buildPodcastExtractorClient("https://scanner", "token", async (url, method, headers, body) => {
      assert.equal(url, "https://scanner/api/internal/podcasts/discover")
      assert.equal(method, "POST")
      assert.equal(headers.Authorization, "Bearer token")
      assert.deepEqual(JSON.parse(body), {
        platform: "rss_feed",
        source_url: "https://example.com/feed.xml",
        published_after: "2026-01-01T00:00:00Z",
        limit: 5,
      })
      return { status: 200, text: JSON.stringify({ code: 0, data: { platform: "rss_feed", episodes: [] } }) }
    })
    const out = await client.discoverEpisodes({ platform: "rss_feed", sourceUrl: "https://example.com/feed.xml", publishedAfter: "2026-01-01T00:00:00Z", limit: 5 })
    assert.equal(out.platform, "rss_feed")
  })
})
