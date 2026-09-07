"""저장된 인코딩만으로 차원별 nDCG 를 다시 내는 경로.

이 경로가 있는 이유: 인코딩이 유일하게 비싼 일이고(4B·4.5만 건 = 3시간),
2026-09-07 에 평가 단계에서 죽어 그 3시간을 통째로 잃었다. 저장해 두면 재채점은 초 단위다.
"""
from __future__ import annotations

import numpy as np
import pytest

from embed.bakeoff import score_saved


def _fixture(tmp_path, judgments_text):
    j = tmp_path / "j.yml"; j.write_text(judgments_text, encoding="utf-8")
    # 문서 3건 · 4차원. 앞 2차원만 봐도 순위가 같게, 뒤 2차원은 잡음으로 둔다.
    vec = tmp_path / "v.npz"
    np.savez_compressed(vec,
        vectors=np.array([[1.0, 0.0, .3, .3], [0.0, 1.0, .3, .3], [.7, .7, .3, .3]], dtype=np.float32),
        ids=np.array(["1", "2", "3"]), hashes=np.array(["a", "b", "c"]),
        texts=np.array(["x", "y", "z"], dtype=object), model_ref="m@abc1234#d4")
    q = tmp_path / "q.npz"
    np.savez_compressed(q, vectors=np.array([[1.0, 0.0, 0.0, 0.0]], dtype=np.float32),
                        queries=np.array(["궁궐"], dtype=object), model_ref="m@abc1234#d4")
    return str(vec), str(q), str(j)


JUDG = """version: 0
queries:
  - query: "궁궐"
    lang: ko
    candidates:
      - {id: "1", title: "경복궁", grade: 3}
      - {id: "2", title: "식당", grade: 0}
      - {id: "3", title: "고궁", grade: 2}
"""


def test_scores_without_a_model(tmp_path):
    """모델을 부르지 않고 점수가 나온다 — 그것이 이 경로의 존재 이유다."""
    v, q, j = _fixture(tmp_path, JUDG)
    rows = score_saved(v, q, j, "ko", dims=[2, 4], k=10)
    assert [r["dim"] for r in rows] == [2, 4]
    assert all(r["ndcg@10"] is not None for r in rows)
    assert all(r["judged_queries"] == 1 for r in rows)
    assert all(r["docs"] == 3 for r in rows)


def test_perfect_ranking_scores_one(tmp_path):
    """질의 벡터가 정답 문서와 같은 방향이면 1위가 되어 nDCG 가 1.0 이다."""
    v, q, j = _fixture(tmp_path, JUDG)
    rows = score_saved(v, q, j, "ko", dims=[2], k=10)
    assert rows[0]["ndcg@10"] == pytest.approx(1.0)


def test_dim_beyond_vector_width_is_skipped(tmp_path):
    """저장된 폭보다 큰 차원은 만들어 낼 수 없다 — 조용히 건너뛴다."""
    v, q, j = _fixture(tmp_path, JUDG)
    assert [r["dim"] for r in score_saved(v, q, j, "ko", dims=[2, 4, 8], k=10)] == [2, 4]


def test_other_language_is_excluded(tmp_path):
    """lang 필터가 듣는다 — 안 그러면 한국어 표에 영어 질의가 섞인다."""
    v, q, j = _fixture(tmp_path, JUDG)
    assert score_saved(v, q, j, "en", dims=[2], k=10)[0]["judged_queries"] == 0
