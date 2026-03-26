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
from octoarms_sdk import TaskContext, build_data_api_upsert_fn

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
```

Run tests:

```bash
cd python
python3 -m unittest octoarms_sdk.data_api_test
```

## TypeScript SDK

Install with pnpm:

```bash
pnpm add @coinsummer/octoarms-sdk
```

Minimal usage:

```ts
import { CollectorContext } from "@coinsummer/octoarms-sdk"

const ctx = new CollectorContext({
  runId: "run-1",
  taskName: "demo_task",
  taskVersion: "v0.1.0",
})

ctx.log("info", "collector started")
ctx.emit("demo.schema", { foo: "bar" })
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
