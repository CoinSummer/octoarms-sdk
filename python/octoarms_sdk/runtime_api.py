from __future__ import annotations

import json
import urllib.error
import urllib.request
from collections.abc import Callable
from typing import Any


RuntimeRequestFn = Callable[[str, str, dict[str, str], bytes], tuple[int, str]]


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


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


class TaskRuntimeClient:
    def __init__(self, *, base_url: str, token: str, request_fn: RuntimeRequestFn) -> None:
        self._base_url = base_url
        self._token = token
        self._request = request_fn

    def _call(self, route: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not self._base_url:
            raise RuntimeError("task runtime endpoint is required")

        endpoint = f"{self._base_url}{route}"
        headers = {
            "Content-Type": "application/json",
        }
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"

        status, text = self._request(endpoint, "POST", headers, json.dumps(payload, ensure_ascii=False).encode("utf-8"))
        if status < 200 or status >= 300:
            raise RuntimeError(f"task runtime request failed: http {status} {text}")

        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return {}
        if not isinstance(parsed, dict):
            return {}
        data = parsed.get("data")
        if isinstance(data, dict):
            return data
        return parsed

    def resolve_snapshot(self, *, snapshot_ref: str, task_name: str = "", run_id: str = "") -> list[dict[str, Any]]:
        data = self._call(
            "/api/external/task-runtime/snapshot/resolve",
            {
                "snapshot_ref": str(snapshot_ref).strip(),
                "task_name": str(task_name).strip(),
                "run_id": str(run_id).strip(),
            },
        )
        items = data.get("items")
        if not isinstance(items, list):
            return []
        return [item for item in items if isinstance(item, dict)]

    def claim_cursor(self, *, task_name: str, source_id: int) -> dict[str, Any]:
        data = self._call(
            "/api/external/task-runtime/cursor/claim",
            {
                "task_name": str(task_name),
                "source_id": int(source_id),
            },
        )
        data["cursor_json"] = _as_dict(data.get("cursor_json"))
        return data

    def commit_cursor(
        self,
        *,
        task_name: str,
        source_id: int,
        expected_version: int,
        cursor_json: dict[str, Any],
    ) -> dict[str, Any]:
        data = self._call(
            "/api/external/task-runtime/cursor/commit",
            {
                "task_name": str(task_name),
                "source_id": int(source_id),
                "expected_version": int(expected_version),
                "cursor_json": _as_dict(cursor_json),
            },
        )
        data["cursor_json"] = _as_dict(data.get("cursor_json"))
        return data

    def emit(
        self,
        *,
        event_type: str,
        task_name: str,
        task_version: str,
        run_id: str,
        attempt_no: int,
        source_id: int,
        payload: dict[str, Any],
    ) -> None:
        self._call(
            "/api/external/task-runtime/emit",
            {
                "event_type": str(event_type),
                "task_name": str(task_name),
                "task_version": str(task_version),
                "run_id": str(run_id),
                "attempt_no": int(attempt_no),
                "source_id": int(source_id),
                "payload": _as_dict(payload),
            },
        )


def build_task_runtime_client(
    capability_endpoint: str,
    ephemeral_token: str,
    request_fn: RuntimeRequestFn | None = None,
) -> TaskRuntimeClient:
    return TaskRuntimeClient(
        base_url=_normalize_base_url(capability_endpoint),
        token=ephemeral_token.strip(),
        request_fn=request_fn or _default_request,
    )
