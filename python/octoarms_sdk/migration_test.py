from __future__ import annotations

import json
import shutil
import tempfile
import unittest
from pathlib import Path

from octoarms_sdk.migration import migrate


class MigrateTests(unittest.TestCase):
    def test_posts_declared_migration_sql_to_capability_api(self) -> None:
        root = Path(tempfile.mkdtemp(prefix="octoarms-sdk-migrate-"))
        calls: list[dict[str, object]] = []

        try:
            migrations_dir = root / "migrations"
            migrations_dir.mkdir(parents=True, exist_ok=True)
            (migrations_dir / "20260329_01_init.sql").write_text("SELECT 1;\n", encoding="utf-8")

            def fake_request(url: str, method: str, headers: dict[str, str], body: bytes) -> tuple[int, str]:
                calls.append(
                    {
                        "url": url,
                        "method": method,
                        "headers": headers,
                        "body": body.decode("utf-8"),
                    }
                )
                return 200, '{"code":0,"msg":"success"}'

            result = migrate(
                {
                    "task_name": "defillama_tvl_top10",
                    "task_version": "v0.1.0",
                    "migration_version": "20260329_01_init",
                    "capability_endpoint": "http://capability.local",
                    "ephemeral_token": "ephemeral-token",
                    "migration_index": {"20260329_01_init": "migrations/20260329_01_init.sql"},
                    "task_root_dir": str(root),
                },
                request_fn=fake_request,
            )

            self.assertEqual(result["status"], "success")
            self.assertEqual(len(calls), 1)
            self.assertEqual(
                calls[0]["url"],
                "http://capability.local/api/internal/capability/migrations/apply",
            )
            headers = calls[0]["headers"]
            self.assertIsInstance(headers, dict)
            self.assertEqual(headers.get("Authorization"), "Bearer ephemeral-token")

            payload = json.loads(str(calls[0]["body"]))
            self.assertEqual(payload["migration_version"], "20260329_01_init")
            self.assertEqual(payload["sql"], "SELECT 1;\n")
        finally:
            shutil.rmtree(root, ignore_errors=True)


if __name__ == "__main__":
    unittest.main()
