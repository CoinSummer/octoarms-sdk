from __future__ import annotations

import json
import unittest

from collector_sdk.data_api import build_data_api_upsert_fn


class BuildDataAPIUpsertFnTests(unittest.TestCase):
    def test_posts_to_internal_dataset_upsert_endpoint(self) -> None:
        captured: dict[str, str] = {
            "url": "",
            "method": "",
            "body": "",
            "token": "",
        }

        def fake_request(url: str, method: str, headers: dict[str, str], body: bytes) -> tuple[int, str]:
            captured["url"] = url
            captured["method"] = method
            captured["token"] = headers.get("X-Ephemeral-Token", "")
            captured["body"] = body.decode("utf-8")
            return 200, '{"code":0}'

        upsert_fn = build_data_api_upsert_fn(
            capability_endpoint="http://chainbase-block-scanner-fetcher-test-svc",
            ephemeral_token="token-abc",
            request_fn=fake_request,
        )

        upsert_fn(
            {
                "run_id": "115",
                "task_name": "defillama_tvl_top10",
                "task_version": "v0.1.0",
                "attempt_no": 1,
                "dataset": "defillama_tvl_protocols_top10",
                "rows": [
                    {
                        "protocol": "Lido",
                        "rank": 1,
                        "tvl_usd": 123.4,
                        "snapshot_at": "2026-03-25T00:00:00Z",
                    }
                ],
                "key_fields": ["protocol"],
            }
        )

        self.assertEqual(
            captured["url"],
            "http://chainbase-block-scanner-fetcher-test-svc/api/internal/data/datasets/defillama_tvl_protocols_top10/upsert",
        )
        self.assertEqual(captured["method"], "POST")
        self.assertEqual(captured["token"], "token-abc")

        payload = json.loads(captured["body"])
        self.assertEqual(payload["key_fields"], ["protocol"])
        self.assertEqual(payload["audit"]["task_name"], "defillama_tvl_top10")
        self.assertEqual(payload["audit"]["task_version"], "v0.1.0")
        self.assertEqual(payload["audit"]["run_id"], 115)


if __name__ == "__main__":
    unittest.main()
