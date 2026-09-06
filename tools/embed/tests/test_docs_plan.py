"""`plan_batch` — 무엇을 touch 하고 무엇을 다시 임베딩할지. 순수 함수라 네트워크 없이 잠근다."""
from __future__ import annotations

from embed.docs import plan_batch
from embed.embed_text import attraction_text, text_hash

REF = "some/model@abc1234#d512"


def _doc(attraction_id: int, **over):
    base = {"id": attraction_id, "title": "경복궁", "titleDisplay": "경복궁", "titleLocal": None,
            "category": "history", "address": "서울특별시 종로구", "overview": "조선의 법궁", "lang": "ko"}
    base.update(over)
    return base


def _hash_of(doc) -> str:
    return text_hash(REF, attraction_text(
        title=doc.get("titleDisplay") or doc["title"], title_local=doc.get("titleLocal"),
        category=doc.get("category"), address=doc.get("address"), overview=doc.get("overview"),
        lang=doc.get("lang", "ko")))


def test_unchanged_text_becomes_touch_and_carries_no_vector():
    doc = _doc(1)
    plan = plan_batch(REF, [1], {1: doc}, {1: _hash_of(doc)})
    assert plan.embed == []
    assert len(plan.touch) == 1
    assert "vector" not in plan.touch[0]
    assert plan.touch[0]["textHash"] == _hash_of(doc)


def test_changed_text_needs_embedding():
    doc = _doc(1, overview="조선의 법궁이자 정궁")
    plan = plan_batch(REF, [1], {1: doc}, {1: "0" * 64})
    assert plan.touch == []
    assert [i for i, _ in plan.embed] == [1]


def test_never_embedded_row_needs_embedding():
    plan = plan_batch(REF, [7], {7: _doc(7)}, {})
    assert [i for i, _ in plan.embed] == [7]


def test_missing_document_is_reported_not_silently_dropped():
    """공개 API 에 없는 id 를 조용히 건너뛰면 pending 이 줄지 않아 루프가 돈다."""
    plan = plan_batch(REF, [1, 2], {1: _doc(1)}, {})
    assert plan.missing_docs == [2]
    assert [i for i, _ in plan.embed] == [1]
    assert "원문 없음 1" in plan.summary()


def test_title_display_wins_over_raw_title():
    """색인 문서와 같은 규칙 — 꼬리 괄호를 뗀 표시명이 임베딩 텍스트의 머리다."""
    doc = _doc(1, title="경복궁(景福宮)", titleDisplay="경복궁", titleLocal="景福宮")
    plan = plan_batch(REF, [1], {1: doc}, {})
    assert plan.embed[0][1].startswith("경복궁 (景福宮)")


def test_stamp_change_invalidates_every_row():
    """스탬프가 바뀌면 저장된 해시가 전부 어긋나 전량 재임베딩이 된다 — 설계가 의도한 강제다."""
    doc = _doc(1)
    plan = plan_batch("other/model@9999999#d512", [1], {1: doc}, {1: _hash_of(doc)})
    assert plan.touch == [] and len(plan.embed) == 1
