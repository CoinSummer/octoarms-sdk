from __future__ import annotations

import json
import unittest

from octoarms_sdk.runtime_api import build_task_runtime_client


class BuildTaskRuntimeClientTests(unittest.TestCase):
    def test_resolve_snapshot_uses_bearer_and_unwraps_data(self) -> None:
        captured: dict[str, str] = {"url": "", "method": "", "body": "", "auth": ""}

        def fake_request(url: str, method: str, headers: dict[str, str], body: bytes) -> tuple[int, str]:
            captured["url"] = url
            captured["method"] = method
            captured["auth"] = headers.get("Authorization", "")
            captured["body"] = body.decode("utf-8")
            return 200, json.dumps({"code": 0, "msg": "success", "data": {"items": [{"source_id": 1, "source_key": "main"}]}})

        client = build_task_runtime_client(" https://scanner.internal/ ", " token-abc ", request_fn=fake_request)
        items = client.resolve_snapshot(snapshot_ref="snap-1", task_name="twitter_list_tweets", run_id="1001")

        self.assertEqual(items, [{"source_id": 1, "source_key": "main"}])
        self.assertEqual(captured["url"], "https://scanner.internal/api/external/task-runtime/snapshot/resolve")
        self.assertEqual(captured["method"], "POST")
        self.assertEqual(captured["auth"], "Bearer token-abc")

    def test_commit_cursor_builds_expected_payload(self) -> None:
        captured: dict[str, str] = {"body": ""}

        def fake_request(_url: str, _method: str, _headers: dict[str, str], body: bytes) -> tuple[int, str]:
            captured["body"] = body.decode("utf-8")
            return 200, json.dumps({"code": 0, "msg": "success", "data": {"version": 2}})

        client = build_task_runtime_client("https://scanner.internal", "token", request_fn=fake_request)
        client.commit_cursor(
            task_name="twitter_list_tweets",
            source_id=9,
            expected_version=1,
            cursor_json={"since_id": "200"},
        )

        self.assertEqual(
            json.loads(captured["body"]),
            {
                "task_name": "twitter_list_tweets",
                "source_id": 9,
                "expected_version": 1,
                "cursor_json": {"since_id": "200"},
            },
        )

    def test_raise_when_runtime_api_non_2xx(self) -> None:
        def fake_request(_url: str, _method: str, _headers: dict[str, str], _body: bytes) -> tuple[int, str]:
            return 409, "conflict"

        client = build_task_runtime_client("https://scanner.internal", "token", request_fn=fake_request)

        with self.assertRaisesRegex(RuntimeError, r"task runtime request failed: http 409 conflict"):
            client.claim_cursor(task_name="twitter_list_tweets", source_id=1)


if __name__ == "__main__":
    unittest.main()
