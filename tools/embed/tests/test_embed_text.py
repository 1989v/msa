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


# ── 규칙 변형 (P1 비교용) ───────────────────────────────────────────────────

from embed.embed_text import (  # noqa: E402
    address_region,
    attraction_text_no_address,
    attraction_text_no_title,
    attraction_text_region,
    attraction_text_short,
)

FULL_ADDR = "서울특별시 종로구 사직로 161 (세종로)"


def test_address_region_keeps_city_and_district():
    """번지·건물번호는 의미 없는 토큰이라는 가설을 이 함수가 구현한다."""
    assert address_region(FULL_ADDR) == "서울특별시 종로구"
    assert address_region("경기도 수원시 팔달구 정조로 825") == "경기도 수원시"
    assert address_region("제주특별자치도 제주시 애월읍 고성남서길 10") == "제주특별자치도 제주시"


def test_address_region_falls_back_to_two_tokens():
    """패턴이 안 맞아도 빈 문자열을 내지 않는다 — 지역 신호를 통째로 잃으면 안 된다."""
    assert address_region("Jung-gu, Seoul") == "Jung-gu, Seoul"
    assert address_region(None) == ""


def test_variants_differ_from_v1():
    """다섯 규칙이 실제로 다른 텍스트를 낸다 — 같으면 비교가 무의미하다."""
    kw = dict(title="경복궁", category="history", address=FULL_ADDR, overview="가" * 900, lang="ko")
    v1 = attraction_text(**kw)
    outs = {v1, attraction_text_no_address(**kw), attraction_text_region(**kw),
            attraction_text_short(**kw), attraction_text_no_title(**kw)}
    assert len(outs) == 5


def test_no_address_drops_the_address():
    assert "사직로" not in attraction_text_no_address(title="경복궁", address=FULL_ADDR, category="history")


def test_region_keeps_district_but_drops_street():
    out = attraction_text_region(title="경복궁", address=FULL_ADDR, category="history")
    assert "서울특별시 종로구" in out and "사직로" not in out


def test_short_truncates_overview():
    out = attraction_text_short(title="경복궁", overview="가" * 900)
    assert out.count("가") == 300


def test_no_title_never_returns_empty():
    """빈 텍스트는 해시·업서트가 거부한다 — 제목을 빼도 뭔가는 남아야 한다."""
    assert attraction_text_no_title(title="경복궁", category="history") == "역사"
    assert attraction_text_no_title(title="이름만있는곳") == "이름만있는곳"


def test_rules_registry_exposes_every_variant():
    """bakeoff --rules 로 부를 수 있어야 비교가 돌아간다."""
    from embed.bakeoff import RULES
    assert set(RULES) == {"full", "title", "no-address", "region", "short", "no-title"}
