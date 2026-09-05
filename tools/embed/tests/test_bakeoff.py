import numpy as np

from embed.bakeoff import ndcg_at_k, top_k, graded, bm25_baseline


def test_ndcg_perfect_and_worst():
    grades = {"a": 3, "b": 2, "c": 0}
    assert ndcg_at_k(["a", "b", "c"], grades) == 1.0
    assert ndcg_at_k(["c", "b", "a"], grades) < 1.0
    assert ndcg_at_k(["x"], {}) is None            # 판정 없으면 평가에서 빠진다
    assert ndcg_at_k(["x"], {"x": 0}) is None      # 전부 0 도 빠진다 (자동 정답 금지)


def test_top_k_matches_argsort():
    rng = np.random.default_rng(0)
    d = rng.normal(size=(5000, 16)).astype(np.float32); d /= np.linalg.norm(d, axis=1, keepdims=True)
    q = rng.normal(size=(3, 16)).astype(np.float32); q /= np.linalg.norm(q, axis=1, keepdims=True)
    idx = top_k(q, d, k=10, chunk=700)
    ref = np.argsort(-(q @ d.T), axis=1)[:, :10]
    assert (idx == ref).all()


def test_graded_reads_both_candidate_lists_and_bm25_baseline():
    q = {"candidates": [{"id": 1, "grade": 3}, {"id": 2, "grade": None}], "vector_candidates": [{"id": "9", "grade": 0}]}
    assert graded(q) == {"1": 3, "9": 0}
    base = bm25_baseline([q])
    assert base["judged_queries"] == 1 and base["ndcg@10"] == 1.0
