# chainbase-collector-sdk

Python SDK for task collectors running on the Chainbase task platform.

## Install

```bash
pip install .
```

## Usage

```python
from collector_sdk import TaskContext, build_data_api_upsert_fn

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
```
