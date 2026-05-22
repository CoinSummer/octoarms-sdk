import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { buildOssUploadClient } from "./oss_upload_client"

describe("buildOssUploadClient", () => {
  it("uploads base64 content to the external oss endpoint", async () => {
    const client = buildOssUploadClient("https://scanner/", " token ", async (url, method, headers, body) => {
      assert.equal(url, "https://scanner/api/external/oss/uploads")
      assert.equal(method, "POST")
      assert.equal(headers.Authorization, "Bearer token")
      assert.equal(headers["Content-Type"], "application/json")

      const payload = JSON.parse(body)
      assert.deepEqual(payload, {
        bucket: "media-bucket",
        object_key: "podcasts/a.mp3",
        content_base64: "aGVsbG8=",
        content_type: "audio/mpeg",
        metadata: { source: "unit-test" },
      })

      return {
        status: 200,
        text: JSON.stringify({
          code: 0,
          data: {
            bucket: "media-bucket",
            object_key: "podcasts/a.mp3",
            uri: "oss://media-bucket/podcasts/a.mp3",
            access_url: "https://signed.example.com/podcasts/a.mp3",
          },
        }),
      }
    })

    const out = await client.uploadObject({
      bucket: "media-bucket",
      objectKey: "podcasts/a.mp3",
      contentBase64: "aGVsbG8=",
      contentType: "audio/mpeg",
      metadata: { source: "unit-test" },
    })

    assert.equal(out.uri, "oss://media-bucket/podcasts/a.mp3")
  })

  it("encodes bytes for uploadObjectBytes", async () => {
    const client = buildOssUploadClient("https://scanner", "", async (_url, _method, _headers, body) => {
      const payload = JSON.parse(body)
      assert.equal(payload.content_base64, "aGVsbG8=")
      assert.equal(payload.content_type, "")
      assert.deepEqual(payload.metadata, {})
      return { status: 200, text: JSON.stringify({ code: 0, data: { uri: "oss://bucket/key.txt" } }) }
    })

    const out = await client.uploadObjectBytes({
      bucket: "bucket",
      objectKey: "key.txt",
      content: new TextEncoder().encode("hello"),
    })

    assert.equal(out.uri, "oss://bucket/key.txt")
  })

  it("raises on failed upload", async () => {
    const client = buildOssUploadClient("https://scanner", "", async () => ({
      status: 403,
      text: "forbidden",
    }))

    await assert.rejects(
      async () =>
        await client.uploadObject({
          bucket: "bucket",
          objectKey: "key.txt",
          contentBase64: "aGVsbG8=",
        }),
      /oss upload request failed: http 403 forbidden/,
    )
  })
})
