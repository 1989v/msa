import hashlib

import pytest

from embed.embed_text import attraction_text, attraction_title_text, text_hash, OVERVIEW_MAX_CHARS


def test_full_rule_golden():
    text = attraction_text(title="경복궁", category="history", address="서울특별시 종로구 사직로 161 (세종로)",
                           overview="경복궁은 <br>조선왕조&nbsp;제일의   법궁이다.", lang="ko")
    assert text == "경복궁 · 역사 · 서울특별시 종로구 사직로 161 (세종로) · 경복궁은 조선왕조 제일의 법궁이다."


def test_title_local_and_missing_parts():
    assert attraction_text(title="Dosan Park", title_local="도산공원", category="nature", lang="en") == "Dosan Park (도산공원) · nature"
    assert attraction_text(title="  A  ", lang="ko") == "A"


def test_overview_truncated_to_1000_chars():
    text = attraction_text(title="T", overview="가" * 2000, lang="ko")
    assert text == "T · " + "가" * OVERVIEW_MAX_CHARS


def test_title_rule_ignores_other_fields():
    assert attraction_title_text(title="경복궁", title_local=None, category="history", overview="x") == "경복궁"


def test_blank_title_rejected():
    with pytest.raises(ValueError):
        attraction_text(title="  ", lang="ko")


def test_hash_contract_is_model_ref_lf_text():
    ref, text = "Qwen/Qwen3-Embedding-4B@f460253#d512", "경복궁 · 역사"
    assert text_hash(ref, text) == hashlib.sha256(f"{ref}\n{text}".encode("utf-8")).hexdigest()
    assert text_hash(ref, text) != text_hash("other@1234567#d512", text)
