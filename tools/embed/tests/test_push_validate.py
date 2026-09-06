"""parquet 검사 — 업서트는 요청 단위 all-or-nothing 이라, 한 행이 틀리면 배치 전체가 거부된다.
서버 400 보다 여기서 먼저 잡는 편이 빠르고, 어느 행이 왜 틀렸는지가 남는다."""
from __future__ import annotations

import numpy as np
import pytest

pd = pytest.importorskip("pandas", reason="parquet 검사는 pandas 가 있어야 돈다 (extras: model)")

from embed.embed_text import text_hash  # noqa: E402
from embed.push import validate  # noqa: E402

REF = "some/model@abc1234#d2"


def _frame(rows):
    return pd.DataFrame(rows)


def _row(attraction_id=1, text="경복궁 · 역사", vector=(0.6, 0.8), ref=REF, dim=2, digest=None):
    return {"attraction_id": attraction_id, "model_ref": ref, "dim": dim, "embedding_text": text,
            "text_hash": digest if digest is not None else text_hash(ref, text),
            "vector": list(vector)}


def test_accepts_a_consistent_file():
    assert validate(_frame([_row(1), _row(2, text="한옥마을 · 문화")])) == (REF, 2)


def test_rejects_hash_that_does_not_match_text():
    with pytest.raises(ValueError, match="text_hash"):
        validate(_frame([_row(digest="0" * 64)]))


def test_rejects_vector_length_mismatch():
    with pytest.raises(ValueError, match="벡터 길이"):
        validate(_frame([_row(vector=(0.6, 0.8, 0.0))]))


def test_rejects_unnormalized_vector():
    with pytest.raises(ValueError, match="정규화"):
        validate(_frame([_row(vector=(3.0, 4.0))]))


def test_rejects_nan_vector():
    with pytest.raises(ValueError, match="NaN/Inf"):
        validate(_frame([_row(vector=(float("nan"), 0.0))]))


def test_rejects_two_stamps_in_one_file():
    with pytest.raises(ValueError, match="한 스탬프만"):
        validate(_frame([_row(1), _row(2, ref="other/model@9999999#d2")]))


def test_rejects_duplicate_ids():
    """UNIQUE(attraction_id, model_ref) 라 같은 배치에 두 번 들어가면 서버가 배치를 통째로 거부한다."""
    with pytest.raises(ValueError, match="겹친다"):
        validate(_frame([_row(1), _row(1, text="다른 텍스트")]))


def test_rejects_missing_column_and_empty_file():
    bad = _frame([_row()]).drop(columns=["text_hash"])
    with pytest.raises(ValueError, match="없는 컬럼"):
        validate(bad)
    with pytest.raises(ValueError, match="비어 있다"):
        validate(pd.DataFrame(columns=list(_row())))
