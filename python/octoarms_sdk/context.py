from __future__ import annotations

from collections.abc import Callable
from typing import Any


EventSink = Callable[[dict[str, Any]], None]
UpsertFn = Callable[[dict[str, Any]], None]
QueryFn = Callable[[dict[str, Any]], list[dict[str, Any]]]
CapabilityProvider = Callable[[str], Any]


def _noop_event_sink(_: dict[str, Any]) -> None:
    return None


def _noop_upsert(_: dict[str, Any]) -> None:
    return None


def _noop_query(_: dict[str, Any]) -> list[dict[str, Any]]:
    return []


def _noop_capability(_: str) -> Any:
    return None


class TaskContext:
    def __init__(
        self,
        *,
        run_id: str,
        task_name: str,
        task_version: str,
        attempt_no: int = 1,
        event_sink: EventSink | None = None,
        upsert: UpsertFn | None = None,
        query: QueryFn | None = None,
        data_upsert: UpsertFn | None = None,
        data_query: QueryFn | None = None,
        capability_provider: CapabilityProvider | None = None,
    ) -> None:
        self.run_id = run_id
        self.task_name = task_name
        self.task_version = task_version
        self.attempt_no = attempt_no
        self._event_sink = event_sink or _noop_event_sink
        self._data_upsert = upsert or data_upsert or _noop_upsert
        self._data_query = query or data_query or _noop_query
        self._capability_provider = capability_provider or _noop_capability
        self._seq = 0

    def emit(self, schema: str, record: dict[str, Any]) -> None:
        self._push_event("record", {"schema": schema, "record": record})

    def checkpoint(self, data: dict[str, Any]) -> None:
        self._push_event("checkpoint", {"data": data})

    def log(self, level: str, msg: str, fields: dict[str, Any] | None = None) -> None:
        self._push_event("log", {"level": level, "msg": msg, "fields": fields or {}})

    def metric(self, name: str, value: float, tags: dict[str, str] | None = None) -> None:
        self._push_event("metric", {"name": name, "value": value, "tags": tags or {}})

    def capability(self, name: str) -> Any:
        return self._capability_provider(name)

    def cap(self, name: str | None = None) -> Any:
        if name is None:
            return self.capability
        return self.capability(name)

    def upsert(self, dataset: str, rows: list[dict[str, Any]], key_fields: list[str]) -> None:
        self._data_upsert(
            {
                "run_id": self.run_id,
                "task_name": self.task_name,
                "task_version": self.task_version,
                "attempt_no": self.attempt_no,
                "dataset": dataset,
                "rows": rows,
                "key_fields": key_fields,
            }
        )

    def query(
        self,
        dataset: str,
        fields: list[str],
        filters: dict[str, Any],
        limit: int,
    ) -> list[dict[str, Any]]:
        return self._data_query(
            {
                "run_id": self.run_id,
                "task_name": self.task_name,
                "task_version": self.task_version,
                "attempt_no": self.attempt_no,
                "dataset": dataset,
                "fields": fields,
                "filters": filters,
                "limit": limit,
            }
        )

    def _push_event(self, event_type: str, payload: dict[str, Any]) -> None:
        self._seq += 1
        self._event_sink(
            {
                "run_id": self.run_id,
                "task_name": self.task_name,
                "task_version": self.task_version,
                "attempt_no": self.attempt_no,
                "seq": self._seq,
                "event_type": event_type,
                "payload": payload,
            }
        )
