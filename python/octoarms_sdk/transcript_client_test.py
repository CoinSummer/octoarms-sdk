from __future__ import annotations

import json
import unittest

from octoarms_sdk.transcript_client import build_transcript_client


class BuildTranscriptClientTests(unittest.TestCase):
    def test_submits_transcript_and_polls(self) -> None:
        poll_count = 0

        def fake_request(url: str, method: str, headers: dict[str, str], body: bytes) -> tuple[int, str]:
            nonlocal poll_count
            self.assertEqual(headers.get("Authorization"), "Bearer token")
            if url.endswith("/api/external/transcripts") and method == "POST":
                payload = json.loads(body.decode("utf-8"))
                self.assertEqual(payload["url"], "https://example.com/a.mp3")
                self.assertEqual(payload["metadata"], {"source": "unit-test"})
                self.assertEqual(payload["force_retranscribe"], True)
                return 200, json.dumps({"code": 0, "data": {"job_id": "j1", "status": "accepted"}})
            if url.endswith("/api/external/transcripts/j1") and method == "GET":
                poll_count += 1
                if poll_count == 1:
                    return 200, json.dumps({"code": 0, "data": {"job_id": "j1", "status": "running"}})
                return 200, json.dumps({"code": 0, "data": {"job_id": "j1", "status": "completed", "transcript_text": "ok"}})
            raise AssertionError(f"unexpected request: {method} {url}")

        client = build_transcript_client("https://scanner", "token", request_fn=fake_request)
        submit = client.submit_transcript(
            url="https://example.com/a.mp3",
            language="en",
            metadata={"source": "unit-test"},
            force_retranscribe=True,
        )
        out = client.wait_transcript("j1", interval_ms=1, timeout_ms=5000)

        self.assertEqual(submit.get("job_id"), "j1")
        self.assertEqual(out.get("status"), "completed")

    def test_get_transcript_url_encodes_job_id(self) -> None:
        captured: dict[str, str] = {"url": "", "method": ""}

        def fake_request(url: str, method: str, _headers: dict[str, str], _body: bytes) -> tuple[int, str]:
            captured["url"] = url
            captured["method"] = method
            return 200, json.dumps({"code": 0, "data": {"job_id": "job/with space", "status": "completed"}})

        client = build_transcript_client("https://scanner", "", request_fn=fake_request)
        out = client.get_transcript("job/with space")

        self.assertEqual(out.get("status"), "completed")
        self.assertEqual(captured["method"], "GET")
        self.assertEqual(captured["url"], "https://scanner/api/external/transcripts/job%2Fwith%20space")


if __name__ == "__main__":
    unittest.main()
