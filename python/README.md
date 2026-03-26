# octoarms-sdk

Python SDK for task collectors running on the Chainbase task platform.

## Install

```bash
pip install .
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
from octoarms_sdk import TaskContext, build_data_api_upsert_fn

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
