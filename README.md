# octoarms-sdk

Unified SDK repository for Octoarms task runtimes.

## Layout

- `python/` - Python collector SDK (`octoarms_sdk`)
- `typescript/` - TypeScript collector SDK (`collector-sdk-typescript`)

## Python SDK

Install from PyPI:

```bash
pip install octoarms-sdk
```

Minimal usage:

```python
from octoarms_sdk import (
    TaskContext,
    build_data_api_upsert_fn,
    build_oss_upload_client,
    build_podcast_extractor_client,
    build_transcript_client,
    migrate,
)

upsert_fn = build_data_api_upsert_fn(
    capability_endpoint="http://chainbase-block-scanner-fetcher-test-svc",
    ephemeral_token="ephemeral-token",
)

ctx = TaskContext(
    run_id="123",
    task_name="demo_task",
    task_version="v0.1.0",
    attempt_no=1,
    upsert=upsert_fn,
)

ctx.emit("demo.schema", {"foo": "bar"})
ctx.upsert("demo_dataset", [{"id": "1", "foo": "bar"}], ["id"])

extractor = build_podcast_extractor_client(
    capability_endpoint="http://chainbase-block-scanner-fetcher-test-svc",
    ephemeral_token="ephemeral-token",
)
episodes = extractor.discover_episodes(
    platform="rss_feed",
    source_url="https://example.com/feed.xml",
    limit=10,
)
audio = extractor.extract_audio(
    platform="rss_feed",
    episode_url=str(episodes["episodes"][0]["episode_url"]),
)

oss = build_oss_upload_client(
    capability_endpoint="http://chainbase-block-scanner-fetcher-test-svc",
    ephemeral_token="ephemeral-token",
)
uploaded = oss.upload_object_bytes(
    bucket="media-bucket",
    object_key="podcasts/demo.mp3",
    content=b"audio bytes",
    content_type="audio/mpeg",
)

transcripts = build_transcript_client(
    capability_endpoint="http://chainbase-block-scanner-fetcher-test-svc",
    ephemeral_token="ephemeral-token",
)
job = transcripts.submit_transcript(url=str(uploaded["uri"]), language="en")
transcript = transcripts.wait_transcript(str(job["job_id"]))

migrate(
    {
        "task_name": "demo_task",
        "task_version": "v0.1.0",
        "migration_version": "20260329_01_init",
        "capability_endpoint": "http://chainbase-block-scanner-fetcher-test-svc",
        "ephemeral_token": "ephemeral-token",
        "migration_index": {"20260329_01_init": "migrations/20260329_01_init.sql"},
        "task_root_dir": ".",
    }
)
```

Run tests:

```bash
cd python
python3 -m unittest discover -s octoarms_sdk -p '*_test.py'
```

## TypeScript SDK

Install with pnpm:

```bash
pnpm add @coinsummer/octoarms-sdk
```

Minimal usage:

```ts
import { CollectorContext, buildOssUploadClient, migrate } from "@coinsummer/octoarms-sdk"

const ctx = new CollectorContext({
  runId: "run-1",
  taskName: "demo_task",
  taskVersion: "v0.1.0",
})

ctx.log("info", "collector started")
ctx.emit("demo.schema", { foo: "bar" })

const oss = buildOssUploadClient(
  "http://chainbase-block-scanner-fetcher-test-svc",
  "ephemeral-token",
)
const uploaded = await oss.uploadObjectBytes({
  bucket: "media-bucket",
  objectKey: "podcasts/demo.mp3",
  content: new TextEncoder().encode("audio bytes"),
  contentType: "audio/mpeg",
})

await migrate({
  taskName: "demo_task",
  taskVersion: "v0.1.0",
  migrationVersion: "20260329_01_init",
  capabilityEndpoint: "http://chainbase-block-scanner-fetcher-test-svc",
  ephemeralToken: "ephemeral-token",
  migrationIndex: { "20260329_01_init": "migrations/20260329_01_init.sql" },
  taskRootDir: ".",
})
```

Run tests:

```bash
cd typescript
pnpm test
```

Publish to npm (GitHub Actions):

1. Add repository secret `NPM_TOKEN` (npm Automation Token).
2. Bump `typescript/package.json` version.
3. Create and push a `ts-v*` tag, for example:

```bash
git tag ts-v0.1.1
git push origin ts-v0.1.1
```
