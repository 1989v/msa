from embed.pool import merge_pools


def test_merge_dedupes_and_skips_bm25_ids_and_keeps_grades():
    judgments = [{"query": "궁궐", "lang": "ko", "candidates": [{"id": "1", "title": "경복궁"}],
                  "vector_candidates": [{"id": "7", "title": "창덕궁", "category": "", "address": "", "models": ["e5-small"], "grade": 3}]}]
    pools = [
        {"model": "e5-small", "lang": "ko", "per_query": {"궁궐": [{"id": 1, "title": "경복궁"}, {"id": "7", "title": "창덕궁"}, {"id": "9", "title": "덕수궁"}]}},
        {"model": "harrier-270m", "lang": "ko", "per_query": {"궁궐": [{"id": "9", "title": "덕수궁"}, {"id": "11", "title": "경희궁"}]}},
        {"model": "en-only", "lang": "en", "per_query": {"궁궐": [{"id": "99", "title": "x"}]}},
    ]
    out = merge_pools(judgments, pools)[0]["vector_candidates"]
    by_id = {c["id"]: c for c in out}
    assert "1" not in by_id                       # BM25 후보는 다시 넣지 않는다
    assert by_id["7"]["grade"] == 3               # 기존 판정 보존
    assert by_id["9"]["models"] == ["e5-small", "harrier-270m"]
    assert by_id["11"]["models"] == ["harrier-270m"] and by_id["11"]["grade"] is None
    assert "99" not in by_id                      # 다른 lang 풀은 섞지 않는다
