from __future__ import annotations

import json
import urllib.error
import urllib.request
from collections.abc import Callable
from typing import Any


HandlerRequestFn = Callable[[str, str, dict[str, str], bytes], tuple[int, str]]


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
            return int(status), response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        return int(exc.code), exc.read().decode("utf-8", errors="replace")


def _as_dict(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    return {}


class TaskHandlerClient:
    def __init__(self, *, base_url: str, token: str, request_fn: HandlerRequestFn) -> None:
        self._base_url = base_url
        self._token = token
        self._request = request_fn

    def _call(self, route: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not self._base_url:
            raise RuntimeError("task handler endpoint is required")

        endpoint = f"{self._base_url}{route}"
        headers = {"Content-Type": "application/json"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"

        status, text = self._request(endpoint, "POST", headers, json.dumps(payload, ensure_ascii=False).encode("utf-8"))
        if status < 200 or status >= 300:
            raise RuntimeError(f"task handler request failed: http {status} {text}")

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

    def invoke(
        self,
        *,
        handler_name: str,
        execution_mode: str = "sync",
        source: dict[str, Any] | None = None,
        cursor_hint: dict[str, Any] | None = None,
        limits: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self._call(
            "/api/internal/handlers/invoke",
            {
                "handler_name": str(handler_name),
                "execution_mode": str(execution_mode or "sync"),
                "source": _as_dict(source),
                "cursor_hint": _as_dict(cursor_hint),
                "limits": _as_dict(limits),
            },
        )

    def submit_job(
        self,
        *,
        handler_name: str,
        source: dict[str, Any] | None = None,
        cursor_hint: dict[str, Any] | None = None,
        limits: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return {
            "job_id": "phase2-not-implemented",
            "status": "not_supported",
            "result": {
                "handler_name": str(handler_name),
                "source": _as_dict(source),
                "cursor_hint": _as_dict(cursor_hint),
                "limits": _as_dict(limits),
                "reason": "async jobs are not available in phase 1",
            },
        }

    def get_job(self, *, job_id: str) -> dict[str, Any]:
        return {
            "job_id": str(job_id),
            "status": "not_supported",
            "result": {"reason": "async jobs are not available in phase 1"},
        }


def build_task_handler_client(
    capability_endpoint: str,
    ephemeral_token: str,
    request_fn: HandlerRequestFn | None = None,
) -> TaskHandlerClient:
    return TaskHandlerClient(
        base_url=_normalize_base_url(capability_endpoint),
        token=ephemeral_token.strip(),
        request_fn=request_fn or _default_request,
    )
