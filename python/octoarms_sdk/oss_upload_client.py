from __future__ import annotations

import base64
import json
import urllib.error
import urllib.request
from collections.abc import Callable
from typing import Any


OSSUploadRequestFn = Callable[[str, str, dict[str, str], bytes], tuple[int, str]]


def _normalize_base_url(raw: str) -> str:
    return raw.strip().rstrip("/")


def _default_request(url: str, method: str, headers: dict[str, str], body: bytes) -> tuple[int, str]:
    req = urllib.request.Request(url=url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
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


class OSSUploadClient:
    def __init__(self, *, base_url: str, token: str, request_fn: OSSUploadRequestFn) -> None:
        self._base_url = base_url
        self._token = token
        self._request = request_fn

    def upload_object(
        self,
        *,
        object_key: str,
        content_base64: str,
        bucket: str = "",
        content_type: str = "",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        if not self._base_url:
            raise RuntimeError("oss upload endpoint is required")

        headers = {"Content-Type": "application/json"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"

        payload = {
            "bucket": str(bucket),
            "object_key": str(object_key),
            "content_base64": str(content_base64),
            "content_type": str(content_type).strip(),
            "metadata": metadata if isinstance(metadata, dict) else {},
        }
        status, text = self._request(
            f"{self._base_url}/api/external/oss/uploads",
            "POST",
            headers,
            json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        )
        if status < 200 or status >= 300:
            raise RuntimeError(f"oss upload request failed: http {status} {text}")
        return _parse_response(text)

    def upload_object_bytes(
        self,
        *,
        object_key: str,
        content: bytes,
        bucket: str = "",
        content_type: str = "",
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        return self.upload_object(
            bucket=bucket,
            object_key=object_key,
            content_base64=base64.b64encode(content).decode("ascii"),
            content_type=content_type,
            metadata=metadata,
        )


def build_oss_upload_client(
    capability_endpoint: str,
    ephemeral_token: str,
    request_fn: OSSUploadRequestFn | None = None,
) -> OSSUploadClient:
    return OSSUploadClient(
        base_url=_normalize_base_url(capability_endpoint),
        token=ephemeral_token.strip(),
        request_fn=request_fn or _default_request,
    )
