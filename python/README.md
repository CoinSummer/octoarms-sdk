# octoarms-sdk

Python SDK for task collectors running on the Chainbase task platform.

## Install

```bash
pip install octoarms-sdk
```

## Publish to PyPI

### Local build and check

```bash
python -m pip install --upgrade build twine
python -m build
twine check dist/*
```

### Manual upload

```bash
twine upload dist/*
```

### GitHub Actions auto publish

1. Add repository secret `PYPI_API_TOKEN` (value: your PyPI API token).
2. Bump version in `python/pyproject.toml`.
3. Create and push tag with `py-v*` format, for example:

```bash
git tag py-v0.1.1
git push origin py-v0.1.1
```

## Usage

```python
from octoarms_sdk import (
    TaskContext,
    build_data_api_upsert_fn,
    build_oss_upload_client,
    build_podcast_extractor_client,
    build_transcript_client,
)

upsert_fn = build_data_api_upsert_fn(
    capability_endpoint="http://chainbase-block-scanner-fetcher-test-svc",
    ephemeral_token="token-abc",
)

ctx = TaskContext(
    run_id="123",
    task_name="demo_task",
    task_version="v0.1.0",
    upsert=upsert_fn,
)

extractor = build_podcast_extractor_client(
    capability_endpoint="http://chainbase-block-scanner-fetcher-test-svc",
    ephemeral_token="token-abc",
)
audio = extractor.extract_audio(
    platform="rss_feed",
    episode_url="https://example.com/episode",
)

oss = build_oss_upload_client(
    capability_endpoint="http://chainbase-block-scanner-fetcher-test-svc",
    ephemeral_token="token-abc",
)
uploaded = oss.upload_object_bytes(
    object_key="podcasts/demo.mp3",
    content=b"audio bytes",
    content_type="audio/mpeg",
)

transcripts = build_transcript_client(
    capability_endpoint="http://chainbase-block-scanner-fetcher-test-svc",
    ephemeral_token="token-abc",
)
job = transcripts.submit_transcript(url=str(uploaded["uri"]), language="en")
transcript = transcripts.wait_transcript(str(job["job_id"]))
```
