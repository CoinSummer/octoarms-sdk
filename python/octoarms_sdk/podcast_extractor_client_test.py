from __future__ import annotations

import json
import unittest

from octoarms_sdk.podcast_extractor_client import build_podcast_extractor_client


class BuildPodcastExtractorClientTests(unittest.TestCase):
    def test_calls_discover_endpoint(self) -> None:
        captured: dict[str, str] = {"url": "", "method": "", "auth": "", "body": ""}

        def fake_request(url: str, method: str, headers: dict[str, str], body: bytes) -> tuple[int, str]:
            captured["url"] = url
            captured["method"] = method
            captured["auth"] = headers.get("Authorization", "")
            captured["body"] = body.decode("utf-8")
            return 200, json.dumps({"code": 0, "data": {"platform": "rss_feed", "episodes": []}})

        client = build_podcast_extractor_client(" https://scanner/ ", " token ", request_fn=fake_request)
        out = client.discover_episodes(
            platform="rss_feed",
            source_url="https://example.com/feed.xml",
            published_after="2026-01-01T00:00:00Z",
            limit=5,
        )

        self.assertEqual(out.get("platform"), "rss_feed")
        self.assertEqual(captured["url"], "https://scanner/api/internal/podcasts/discover")
        self.assertEqual(captured["method"], "POST")
        self.assertEqual(captured["auth"], "Bearer token")
        self.assertEqual(
            json.loads(captured["body"]),
            {
                "platform": "rss_feed",
                "source_url": "https://example.com/feed.xml",
                "published_after": "2026-01-01T00:00:00Z",
                "limit": 5,
            },
        )

    def test_calls_extract_endpoint(self) -> None:
        captured: dict[str, str] = {"url": "", "body": ""}

        def fake_request(url: str, _method: str, _headers: dict[str, str], body: bytes) -> tuple[int, str]:
            captured["url"] = url
            captured["body"] = body.decode("utf-8")
            return 200, json.dumps({"code": 0, "data": {"best_audio_url": "https://example.com/a.mp3"}})

        client = build_podcast_extractor_client("https://scanner", "", request_fn=fake_request)
        out = client.extract_audio(platform="apple_podcast", episode_url="https://podcasts.apple.com/episode/1")

        self.assertEqual(out.get("best_audio_url"), "https://example.com/a.mp3")
        self.assertEqual(captured["url"], "https://scanner/api/internal/podcasts/extract")
        self.assertEqual(
            json.loads(captured["body"]),
            {
                "platform": "apple_podcast",
                "episode_url": "https://podcasts.apple.com/episode/1",
            },
        )


if __name__ == "__main__":
    unittest.main()
