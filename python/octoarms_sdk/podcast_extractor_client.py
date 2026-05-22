from __future__ import annotations

import json
import urllib.error
import urllib.request
from collections.abc import Callable
from typing import Any


PodcastExtractorRequestFn = Callable[[str, str, dict[str, str], bytes], tuple[int, str]]


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


class PodcastExtractorClient:
    def __init__(self, *, base_url: str, token: str, request_fn: PodcastExtractorRequestFn) -> None:
        self._base_url = base_url
        self._token = token
        self._request = request_fn

    def _post(self, route: str, payload: dict[str, Any]) -> dict[str, Any]:
        if not self._base_url:
            raise RuntimeError("podcast extractor endpoint is required")

        headers = {"Content-Type": "application/json"}
        if self._token:
            headers["Authorization"] = f"Bearer {self._token}"

        status, text = self._request(
            f"{self._base_url}{route}",
            "POST",
            headers,
            json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        )
        if status < 200 or status >= 300:
            raise RuntimeError(f"podcast extractor request failed: http {status} {text}")
        return _parse_response(text)

    def discover_episodes(
        self,
        *,
        platform: str,
        source_url: str,
        published_after: str = "",
        limit: int = 0,
    ) -> dict[str, Any]:
        return self._post(
            "/api/internal/podcasts/discover",
            {
                "platform": str(platform),
                "source_url": str(source_url),
                "published_after": str(published_after).strip(),
                "limit": int(limit or 0),
            },
        )

    def extract_audio(self, *, platform: str, episode_url: str) -> dict[str, Any]:
        return self._post(
            "/api/internal/podcasts/extract",
            {
                "platform": str(platform),
                "episode_url": str(episode_url),
            },
        )


def build_podcast_extractor_client(
    capability_endpoint: str,
    ephemeral_token: str,
    request_fn: PodcastExtractorRequestFn | None = None,
) -> PodcastExtractorClient:
    return PodcastExtractorClient(
        base_url=_normalize_base_url(capability_endpoint),
        token=ephemeral_token.strip(),
        request_fn=request_fn or _default_request,
    )
