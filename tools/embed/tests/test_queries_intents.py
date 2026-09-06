"""시드 읽기 — 중복 질의가 두 번 임베딩되면 같은 `_id` 를 두 번 쓴다(모델 시간만 버린다)."""
from __future__ import annotations

from embed.queries import load_intents


def test_reads_both_languages_and_keeps_order(tmp_path):
    f = tmp_path / "intents.yml"
    f.write_text("version: 0\nko:\n  - 해수욕장\n  - 궁궐\nen:\n  - beach\n", encoding="utf-8")
    assert load_intents(str(f)) == [("해수욕장", "ko"), ("궁궐", "ko"), ("beach", "en")]


def test_drops_duplicates_and_blanks(tmp_path):
    f = tmp_path / "intents.yml"
    f.write_text("ko:\n  - 해수욕장\n  - '  해수욕장  '\n  - ''\nen:\n  - 해수욕장\n", encoding="utf-8")
    assert load_intents(str(f)) == [("해수욕장", "ko")]


def test_missing_sections_are_not_an_error(tmp_path):
    f = tmp_path / "intents.yml"
    f.write_text("version: 0\n", encoding="utf-8")
    assert load_intents(str(f)) == []
