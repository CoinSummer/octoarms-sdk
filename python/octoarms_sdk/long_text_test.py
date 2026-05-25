from __future__ import annotations

import unittest

from octoarms_sdk.long_text import (
    quote_exists_in_text,
    raise_for_evidence_graph_issues,
    split_text,
    validate_evidence_graph,
)


class LongTextTests(unittest.TestCase):
    def test_split_text_preserves_source_ranges_and_overlap(self) -> None:
        text = "\n\n".join(f"paragraph {index} " + ("x" * 200) for index in range(10))

        chunks = split_text(text, target_chars=700, overlap_chars=100, min_chunk_chars=300)

        self.assertGreater(len(chunks), 1)
        self.assertEqual(chunks[0].chunk_id, "chunk_0000")
        self.assertEqual(chunks[0].index, 0)
        self.assertEqual(chunks[0].char_start, 0)
        self.assertLess(chunks[0].char_end, len(text))
        self.assertLess(chunks[1].char_start, chunks[0].char_end)
        self.assertEqual(chunks[0].text, text[chunks[0].char_start : chunks[0].char_end].strip())

    def test_split_text_rejects_invalid_overlap(self) -> None:
        with self.assertRaisesRegex(ValueError, "overlap_chars"):
            split_text("hello", target_chars=10, overlap_chars=10)

    def test_quote_exists_in_text_normalizes_whitespace_and_case(self) -> None:
        source = "AI factories are\nbecoming a NEW industrial foundation."

        self.assertTrue(quote_exists_in_text("ai factories are becoming a new industrial foundation", source))

    def test_validate_evidence_graph_accepts_consistent_refs(self) -> None:
        issues = validate_evidence_graph(
            insights=[{"insight_id": "ins_1", "evidence_ids": ["ev_1"]}],
            evidence=[{"evidence_id": "ev_1", "quote": "AI factories", "supports": ["ins_1"]}],
            source_text="Jensen said AI factories are industrial infrastructure.",
            validate_quotes_in_source=True,
        )

        self.assertEqual(issues, [])

    def test_validate_evidence_graph_reports_dangling_refs_and_missing_reverse_support(self) -> None:
        issues = validate_evidence_graph(
            insights=[{"insight_id": "ins_1", "evidence_ids": ["ev_1", "ev_missing"]}],
            evidence=[{"evidence_id": "ev_1", "quote": "AI factories", "supports": ["other"]}],
        )

        self.assertEqual([issue.code for issue in issues], ["missing_reverse_support", "dangling_evidence_ref"])
        with self.assertRaisesRegex(ValueError, "missing_reverse_support"):
            raise_for_evidence_graph_issues(issues)

    def test_validate_evidence_graph_reports_quote_not_in_source(self) -> None:
        issues = validate_evidence_graph(
            insights=[{"insight_id": "ins_1", "evidence_ids": ["ev_1"]}],
            evidence=[{"evidence_id": "ev_1", "quote": "not present", "supports": ["ins_1"]}],
            source_text="AI factories are present.",
            validate_quotes_in_source=True,
        )

        self.assertEqual(issues[0].code, "quote_not_in_source")


if __name__ == "__main__":
    unittest.main()
