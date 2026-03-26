# octoarms-sdk

Unified SDK repository for Octoarms task runtimes.

## Layout

- `python/` - Python collector SDK (`octoarms_sdk`)
- `typescript/` - TypeScript collector SDK (`collector-sdk-typescript`)

## Python SDK

Install from this repository:

```bash
pip install "git+https://github.com/CoinSummer/octoarms-sdk.git@main#subdirectory=python"
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

Install in another project:

```bash
npm install "github:CoinSummer/octoarms-sdk#main"
```

Minimal usage:

```ts
import { CollectorContext } from "./typescript/src/index"

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
npm test
```
