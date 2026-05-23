from __future__ import annotations

import json
import unittest

from octoarms_sdk.oss_upload_client import build_oss_upload_client


class BuildOSSUploadClientTests(unittest.TestCase):
    def test_uploads_base64_content_to_external_oss_endpoint(self) -> None:
        def fake_request(url: str, method: str, headers: dict[str, str], body: bytes) -> tuple[int, str]:
            self.assertEqual(url, "https://scanner/api/external/oss/uploads")
            self.assertEqual(method, "POST")
            self.assertEqual(headers.get("Authorization"), "Bearer token")
            self.assertEqual(headers.get("Content-Type"), "application/json")

            payload = json.loads(body.decode("utf-8"))
            self.assertEqual(
                payload,
                {
                    "bucket": "media-bucket",
                    "object_key": "podcasts/a.mp3",
                    "content_base64": "aGVsbG8=",
                    "content_type": "audio/mpeg",
                    "metadata": {"source": "unit-test"},
                },
            )

            return 200, json.dumps(
                {
                    "code": 0,
                    "data": {
                        "bucket": "media-bucket",
                        "object_key": "podcasts/a.mp3",
                        "uri": "oss://media-bucket/podcasts/a.mp3",
                        "access_url": "https://signed.example.com/podcasts/a.mp3",
                    },
                }
            )

        client = build_oss_upload_client("https://scanner/", " token ", request_fn=fake_request)
        out = client.upload_object(
            bucket="media-bucket",
            object_key="podcasts/a.mp3",
            content_base64="aGVsbG8=",
            content_type="audio/mpeg",
            metadata={"source": "unit-test"},
        )

        self.assertEqual(out.get("uri"), "oss://media-bucket/podcasts/a.mp3")

    def test_encodes_bytes_for_upload_object_bytes(self) -> None:
        def fake_request(_url: str, _method: str, _headers: dict[str, str], body: bytes) -> tuple[int, str]:
            payload = json.loads(body.decode("utf-8"))
            self.assertEqual(payload["content_base64"], "aGVsbG8=")
            self.assertEqual(payload["content_type"], "")
            self.assertEqual(payload["metadata"], {})
            return 200, json.dumps({"code": 0, "data": {"uri": "oss://bucket/key.txt"}})

        client = build_oss_upload_client("https://scanner", "", request_fn=fake_request)
        out = client.upload_object_bytes(bucket="bucket", object_key="key.txt", content=b"hello")

        self.assertEqual(out.get("uri"), "oss://bucket/key.txt")

    def test_allows_backend_configured_bucket_by_omitting_bucket(self) -> None:
        def fake_request(_url: str, _method: str, _headers: dict[str, str], body: bytes) -> tuple[int, str]:
            payload = json.loads(body.decode("utf-8"))
            self.assertEqual(payload["bucket"], "")
            self.assertEqual(payload["object_key"], "datasets/demo.json")
            return 200, json.dumps(
                {"code": 0, "data": {"bucket": "dataset-bucket", "uri": "oss://dataset-bucket/datasets/demo.json"}}
            )

        client = build_oss_upload_client("https://scanner", "", request_fn=fake_request)
        out = client.upload_object(
            object_key="datasets/demo.json",
            content_base64="eyJvayI6dHJ1ZX0=",
            content_type="application/json",
        )

        self.assertEqual(out.get("bucket"), "dataset-bucket")

    def test_raises_on_failed_upload(self) -> None:
        def fake_request(_url: str, _method: str, _headers: dict[str, str], _body: bytes) -> tuple[int, str]:
            return 403, "forbidden"

        client = build_oss_upload_client("https://scanner", "", request_fn=fake_request)

        with self.assertRaisesRegex(RuntimeError, "oss upload request failed: http 403 forbidden"):
            client.upload_object(bucket="bucket", object_key="key.txt", content_base64="aGVsbG8=")


if __name__ == "__main__":
    unittest.main()
