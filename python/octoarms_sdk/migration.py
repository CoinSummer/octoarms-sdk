from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from .data_api import RequestFn


def _normalize_base_url(raw: str) -> str:
    base = raw.strip()
    if not base:
        return ""
    return base.rstrip("/")


def _default_request(url: str, method: str, headers: dict[str, str], body: bytes) -> tuple[int, str]:
    req = urllib.request.Request(url=url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            status = getattr(response, "status", response.getcode())
            text = response.read().decode("utf-8")
            return int(status), text
    except urllib.error.HTTPError as exc:
        text = exc.read().decode("utf-8", errors="replace")
        return int(exc.code), text


def _resolve_sql_path(task_root_dir: str, relative_path: str) -> Path:
    root = Path(task_root_dir).resolve()
    target = (root / relative_path).resolve()
    if root != target and root not in target.parents:
        raise ValueError(f"migration file escapes task root: {relative_path}")
    return target


def migrate(
    options: dict[str, Any],
    request_fn: RequestFn | None = None,
) -> dict[str, str]:
    migration_index = options.get("migration_index") or {}
    migration_version = str(options.get("migration_version") or "")
    relative_path = str(migration_index.get(migration_version) or "")
    if not relative_path:
        raise ValueError(f"migration version not found in migration_index: {migration_version}")

    base_url = _normalize_base_url(str(options.get("capability_endpoint") or ""))
    if not base_url:
        raise ValueError("capability_endpoint is empty")

    task_root_dir = str(options.get("task_root_dir") or "")
    sql_path = _resolve_sql_path(task_root_dir, relative_path)
    sql = sql_path.read_text(encoding="utf-8")

    endpoint = f"{base_url}/api/internal/capability/migrations/apply"
    headers = {
        "Content-Type": "application/json",
    }
    token = str(options.get("ephemeral_token") or "").strip()
    if token:
        headers["Authorization"] = f"Bearer {token}"

    body = json.dumps(
        {
            "task_name": options.get("task_name"),
            "task_version": options.get("task_version"),
            "migration_version": migration_version,
            "sql": sql,
        },
        ensure_ascii=False,
    ).encode("utf-8")

    request = request_fn or _default_request
    status, response_text = request(endpoint, "POST", headers, body)
    if status < 200 or status >= 300:
        raise RuntimeError(f"migration apply failed: http {status} {response_text}")

    return {"status": "success"}
