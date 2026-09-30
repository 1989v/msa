"""비슷한 곳 계산 — 같은 언어·같은 유형·**다른 시도** 에서 코사인 상위 5 (자기 제외).

판정 근거는 `similar.top_k_elsewhere` 가 내놓은 id·점수 목록이다. 기대값은 손으로 만든 작은 벡터에서
눈으로 셀 수 있게 잡았다.
"""
from __future__ import annotations

import numpy as np
import pytest

from embed import similar


def _unit(*xs):
    v = np.asarray(xs, dtype=np.float32)
    return v / np.linalg.norm(v)


def _doc(i, lang="ko", type_="12", sido="11", title=None):
    return similar.Doc(id=i, lang=lang, content_type_id=type_, sido=sido, title=title or f"t{i}")


def _run(docs, vecs, **kw):
    return similar.top_k_elsewhere(docs, np.stack(vecs), **kw)


def test_only_other_sido_same_lang_same_type_and_never_self():
    docs = [
        _doc(1, sido="11"),
        _doc(2, sido="11"),               # 같은 시도 — 가장 가깝지만 빠져야 한다
        _doc(3, sido="26"),               # 다른 시도 — 후보
        _doc(4, sido="26", lang="en"),    # 다른 언어 — 빠진다
        _doc(5, sido="26", type_="14"),   # 다른 유형 — 빠진다
    ]
    same = _unit(1, 0)
    lists = _run(docs, [same, same, _unit(1, 1), same, same])

    assert [s.id for s in lists[1]] == [3]
    assert [s.id for s in lists[3]] == [1, 2]
    assert all(s.id != d for d, items in lists.items() for s in items)


def test_top_five_in_descending_score_order():
    docs = [_doc(0, sido="11")] + [_doc(i, sido="26") for i in range(1, 8)]
    # 0 과의 코사인이 id 가 클수록 커지게 — 상위 5 는 7,6,5,4,3
    vecs = [_unit(1, 0)] + [_unit(1, 8 - i) for i in range(1, 8)]
    items = _run(docs, vecs)[0]

    assert [s.id for s in items] == [7, 6, 5, 4, 3]
    scores = [s.score for s in items]
    assert scores == sorted(scores, reverse=True)
    assert scores[0] == pytest.approx(float(_unit(1, 1) @ _unit(1, 0)), abs=1e-6)


def test_block_boundary_gives_same_answer_as_one_block():
    rng = np.random.default_rng(7)
    n = 23
    docs = [_doc(i, sido=("11", "26", "41")[i % 3], type_=("12", "14")[i % 2]) for i in range(n)]
    raw = rng.normal(size=(n, 8)).astype(np.float32)
    vecs = list(raw / np.linalg.norm(raw, axis=1, keepdims=True))

    whole = _run(docs, vecs, block=1024)
    for block in (1, 4, 5):
        chopped = _run(docs, vecs, block=block)
        assert {d: [s.id for s in v] for d, v in chopped.items()} == {d: [s.id for s in v] for d, v in whole.items()}


def test_fewer_candidates_than_k_and_documents_without_codes():
    docs = [
        _doc(1, sido="11"),
        _doc(2, sido="26"),
        _doc(3, sido=None),              # 시도를 모르면 「다른 시도」를 판정할 수 없다 — 질의도 후보도 아니다
        _doc(4, sido="26", type_=None),  # 유형을 모르면 마찬가지
    ]
    v = _unit(1, 0)
    lists = _run(docs, [v, v, v, v])

    assert [s.id for s in lists[1]] == [2]
    assert [s.id for s in lists[2]] == [1]
    assert 3 not in lists and 4 not in lists


def test_bulk_items_carry_ranked_ids_and_clear_documents_with_no_candidates():
    docs = [_doc(1, sido="11"), _doc(2, sido="26"), _doc(9, sido="11", type_="39")]
    v = _unit(1, 0)
    lists = _run(docs, [v, v, v])

    items = similar.bulk_items(docs, lists)
    by_id = {it["attractionId"]: it for it in items}
    assert by_id[1]["similar"] == [{"id": 2, "score": pytest.approx(1.0, abs=1e-6)}]
    # 후보가 없어진 문서는 빈 목록으로 보낸다 — 옛 목록이 남지 않게 서버가 지운다
    assert by_id[9]["similar"] == []
