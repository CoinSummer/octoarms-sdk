from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


@dataclass(frozen=True)
class TextChunk:
    chunk_id: str
    index: int
    char_start: int
    char_end: int
    text: str


@dataclass(frozen=True)
class EvidenceValidationIssue:
    code: str
    message: str
    path: str


def split_text(
    text: str,
    target_chars: int = 18_000,
    overlap_chars: int = 1_200,
    *,
    min_chunk_chars: int = 1_000,
    chunk_id_prefix: str = "chunk",
) -> list[TextChunk]:
    source = str(text or "")
    if not source:
        return []
    if target_chars <= 0:
        raise ValueError("target_chars must be > 0")
    if overlap_chars < 0:
        raise ValueError("overlap_chars must be >= 0")
    if overlap_chars >= target_chars:
        raise ValueError("overlap_chars must be smaller than target_chars")
    if min_chunk_chars < 0:
        raise ValueError("min_chunk_chars must be >= 0")

    chunks: list[TextChunk] = []
    start = 0
    source_len = len(source)
    while start < source_len:
        ideal_end = min(source_len, start + target_chars)
        end = _find_chunk_end(source, start, ideal_end, min_chunk_chars)
        if end <= start:
            end = ideal_end
        chunk_text = source[start:end].strip()
        if chunk_text:
            chunks.append(
                TextChunk(
                    chunk_id=f"{chunk_id_prefix}_{len(chunks):04d}",
                    index=len(chunks),
                    char_start=start,
                    char_end=end,
                    text=chunk_text,
                )
            )
        if end >= source_len:
            break
        start = max(0, end - overlap_chars)
    return chunks


def normalize_quote(text: str) -> str:
    return re.sub(r"\s+", " ", str(text or "")).strip().lower()


def compact_text(text: str) -> str:
    return re.sub(r"\s+", "", str(text or "")).strip().lower()


def quote_exists_in_text(quote: str, source_text: str) -> bool:
    normalized_quote = normalize_quote(quote)
    if not normalized_quote:
        return False
    if normalized_quote in normalize_quote(source_text):
        return True
    compact_quote = compact_text(quote)
    return bool(compact_quote and compact_quote in compact_text(source_text))


def validate_evidence_graph(
    insights: list[dict[str, Any]],
    evidence: list[dict[str, Any]],
    *,
    source_text: str | None = None,
    insight_id_field: str = "insight_id",
    evidence_ids_field: str = "evidence_ids",
    evidence_id_field: str = "evidence_id",
    quote_field: str = "quote",
    supports_field: str = "supports",
    validate_quotes_in_source: bool = False,
) -> list[EvidenceValidationIssue]:
    issues: list[EvidenceValidationIssue] = []
    evidence_by_id: dict[str, dict[str, Any]] = {}

    for index, item in enumerate(evidence):
        evidence_id = _string_value(item.get(evidence_id_field))
        quote = _string_value(item.get(quote_field))
        supports = _string_list(item.get(supports_field))
        path = f"evidence[{index}]"
        if not evidence_id:
            issues.append(EvidenceValidationIssue("missing_evidence_id", "evidence id is required", f"{path}.{evidence_id_field}"))
            continue
        if not quote:
            issues.append(EvidenceValidationIssue("missing_quote", "evidence quote is required", f"{path}.{quote_field}"))
        elif validate_quotes_in_source and source_text is not None and not quote_exists_in_text(quote, source_text):
            issues.append(EvidenceValidationIssue("quote_not_in_source", "evidence quote was not found in source text", f"{path}.{quote_field}"))
        if not supports:
            issues.append(EvidenceValidationIssue("missing_supports", "evidence supports are required", f"{path}.{supports_field}"))
        evidence_by_id[evidence_id] = item

    for index, insight in enumerate(insights):
        insight_id = _string_value(insight.get(insight_id_field))
        evidence_ids = _string_list(insight.get(evidence_ids_field))
        path = f"insights[{index}]"
        if not insight_id:
            issues.append(EvidenceValidationIssue("missing_insight_id", "insight id is required", f"{path}.{insight_id_field}"))
        if not evidence_ids:
            issues.append(EvidenceValidationIssue("missing_evidence_refs", "insight evidence refs are required", f"{path}.{evidence_ids_field}"))
        for evidence_id in evidence_ids:
            item = evidence_by_id.get(evidence_id)
            if item is None:
                issues.append(EvidenceValidationIssue("dangling_evidence_ref", f"evidence ref {evidence_id} does not exist", f"{path}.{evidence_ids_field}"))
                continue
            supports = _string_list(item.get(supports_field))
            if insight_id and insight_id not in supports:
                issues.append(
                    EvidenceValidationIssue(
                        "missing_reverse_support",
                        f"evidence {evidence_id} does not support insight {insight_id}",
                        f"evidence.{evidence_id}.{supports_field}",
                    )
                )
    return issues


def raise_for_evidence_graph_issues(issues: list[EvidenceValidationIssue]) -> None:
    if not issues:
        return
    first = issues[0]
    raise ValueError(f"{first.code} at {first.path}: {first.message}")


def _find_chunk_end(text: str, start: int, ideal_end: int, min_chunk_chars: int) -> int:
    if ideal_end >= len(text):
        return len(text)
    min_end = min(len(text), start + min_chunk_chars)
    search = text[min_end:ideal_end]
    for pattern in ("\n\n", "\n", ". ", "? ", "! ", "。", "？", "！"):
        offset = search.rfind(pattern)
        if offset >= 0:
            return min_end + offset + len(pattern)
    return ideal_end


def _string_value(value: Any) -> str:
    return str(value or "").strip()


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    out: list[str] = []
    for item in value:
        text = _string_value(item)
        if text:
            out.append(text)
    return out
