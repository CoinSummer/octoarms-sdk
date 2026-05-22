from __future__ import annotations

import json
import time
import urllib.error
import urllib.parse
import urllib.request
from collections.abc import Callable
from typing import Any


TranscriptRequestFn = Callable[[str, str, dict[str, str], bytes], tuple[int, str]]


def _normalize_base_url(raw: str) -> str:
    return raw.strip().rstrip("/")


def _default_request(url: str, method: str, headers: dict[str, str], body: bytes) -> tuple[int, str]:
    req = urllib.request.Request(url=url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=20) as response:
            status = getattr(response, "status", response.getcode())
            return int(status), response.read().decode("utf-8")
    except urllib.error.HTTPError as exc:
        return int(exc.code), exc.read().decode("utf-8", errors="replace")


def _parse_response(text: str) -> dict[str, Any]:
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


class TranscriptClient:
    def __init__(self, *, base_url: str, token: str, request_fn: TranscriptRequestFn) -> None:
        self._base_url = base_url
        self._token = token
        self._request = request_fn

    def _request_json(self, route: str, method: str, payload: dict[str, Any] | None = None) -> dict[str, Any]:
        if not self._base_url:
            raise RuntimeError("transcript endpoint is required")

        headers = {"Content-Type": "application/json"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"

        status, text = self._request(
            f"{self._base_url}{route}",
            method,
            headers,
            json.dumps(payload or {}, ensure_ascii=False).encode("utf-8"),
        )
        if status < 200 or status >= 300:
            raise RuntimeError(f"transcript request failed: http {status} {text}")
        return _parse_response(text)

    def submit_transcript(
        self,
        *,
        url: str,
        language: str = "",
        title: str = "",
        metadata: dict[str, Any] | None = None,
        force_retranscribe: bool = False,
    ) -> dict[str, Any]:
        return self._request_json(
            "/api/external/transcripts",
            "POST",
            {
                "url": str(url),
                "language": str(language).strip(),
                "title": str(title).strip(),
                "metadata": metadata if isinstance(metadata, dict) else {},
                "force_retranscribe": bool(force_retranscribe),
            },
        )

    def get_transcript(self, job_id: str) -> dict[str, Any]:
        encoded_job_id = urllib.parse.quote(str(job_id), safe="")
        return self._request_json(f"/api/external/transcripts/{encoded_job_id}", "GET")

    def wait_transcript(self, job_id: str, *, interval_ms: int = 1000, timeout_ms: int = 120000) -> dict[str, Any]:
        interval_seconds = max(200, int(interval_ms)) / 1000
        timeout_seconds = max(1000, int(timeout_ms)) / 1000
        deadline = time.monotonic() + timeout_seconds

        while True:
            out = self.get_transcript(job_id)
            status = str(out.get("status") or "")
            if status in {"completed", "failed", "canceled"}:
                return out
            if time.monotonic() >= deadline:
                raise RuntimeError(f"wait transcript timeout: {job_id}")
            time.sleep(interval_seconds)


def build_transcript_client(
    capability_endpoint: str,
    ephemeral_token: str,
    request_fn: TranscriptRequestFn | None = None,
) -> TranscriptClient:
    return TranscriptClient(
        base_url=_normalize_base_url(capability_endpoint),
        token=ephemeral_token.strip(),
        request_fn=request_fn or _default_request,
    )
