from __future__ import annotations

import json
import unittest

from octoarms_sdk.handler_api import build_task_handler_client


class BuildTaskHandlerClientTests(unittest.TestCase):
    def test_invoke_sync_handler(self) -> None:
        captured: dict[str, str] = {"url": "", "body": "", "auth": ""}

        def fake_request(url: str, method: str, headers: dict[str, str], body: bytes) -> tuple[int, str]:
            self.assertEqual(method, "POST")
            captured["url"] = url
            captured["body"] = body.decode("utf-8")
            captured["auth"] = headers.get("Authorization", "")
            return 200, json.dumps({"code": 0, "msg": "success", "data": {"status": "done", "records": []}})

        client = build_task_handler_client("https://scanner", "token", request_fn=fake_request)
        out = client.invoke(handler_name="twitter.list_tweets", execution_mode="sync")

        self.assertEqual(captured["url"], "https://scanner/api/internal/handlers/invoke")
        self.assertEqual(captured["auth"], "Bearer token")
        self.assertEqual(out.get("status"), "done")

    def test_submit_job_and_get_job_placeholders(self) -> None:
        client = build_task_handler_client("https://scanner", "token", request_fn=lambda *_args: (200, "{}"))
        submit = client.submit_job(handler_name="twitter.list_tweets")
        get = client.get_job(job_id="job-1")
        self.assertEqual(submit.get("status"), "not_supported")
        self.assertEqual(get.get("status"), "not_supported")


if __name__ == "__main__":
    unittest.main()
