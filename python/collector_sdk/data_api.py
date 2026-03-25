from __future__ import annotations

import json
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable
from typing import Any


RequestFn = Callable[[str, str, dict[str, str], bytes], tuple[int, str]]
UpsertFn = Callable[[dict[str, Any]], None]


def _noop_upsert(_: dict[str, Any]) -> None:
    return None


def _normalize_base_url(raw: str) -> str:
    base = raw.strip()
    if not base:
        return ""
    return base.rstrip("/")


def _parse_run_id(raw: Any) -> int | None:
    try:
        run_id = int(raw)
    except (TypeError, ValueError):
        return None

    if run_id <= 0:
        return None
    return run_id


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


def build_data_api_upsert_fn(
    capability_endpoint: str,
    ephemeral_token: str,
    request_fn: RequestFn | None = None,
) -> UpsertFn:
    base_url = _normalize_base_url(capability_endpoint)
    if not base_url:
        return _noop_upsert

    token = ephemeral_token.strip()
    request = request_fn or _default_request

    def _upsert(payload: dict[str, Any]) -> None:
        dataset = str(payload.get("dataset") or "")
        endpoint = f"{base_url}/api/internal/data/datasets/{urllib.parse.quote(dataset, safe='')}/upsert"

        audit: dict[str, Any] = {
            "task_name": payload.get("task_name"),
            "task_version": payload.get("task_version"),
        }
        run_id = _parse_run_id(payload.get("run_id"))
        if run_id is not None:
            audit["run_id"] = run_id

        body_obj = {
            "rows": payload.get("rows", []),
            "key_fields": payload.get("key_fields", []),
            "audit": audit,
        }
        body = json.dumps(body_obj, ensure_ascii=False).encode("utf-8")

        headers = {
            "Content-Type": "application/json",
        }
        if token:
            headers["X-Ephemeral-Token"] = token

        status, response_text = request(endpoint, "POST", headers, body)
        if status < 200 or status >= 300:
            raise RuntimeError(f"data upsert failed: http {status} {response_text}")

    return _upsert
