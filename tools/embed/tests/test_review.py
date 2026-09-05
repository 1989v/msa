from embed.review import rows, sheet, stats

DOC = {"queries": [{
    "query": "궁궐", "lang": "ko", "intent": "조선 궁궐",
    "candidates": [{"id": "1", "title": "경복궁", "category": "history", "address": "서울", "grade": 3},
                   {"id": "2", "title": "한복남", "category": "culture", "address": "서울", "grade": None}],
    "vector_candidates": [{"id": "1", "title": "경복궁", "category": "history", "address": "서울", "models": ["e5-small"], "grade": 3},
                          {"id": "9", "title": "창덕궁", "category": "history", "address": "서울", "models": ["e5-small", "arctic-ko"], "grade": None}],
}]}


def test_rows_merges_sources_for_same_doc():
    by_id = {r["id"]: r for r in rows(DOC["queries"][0])}
    assert by_id["1"]["from"] == ["bm25#1", "vec:e5-small"]      # 양쪽에서 찾은 문서는 출처가 합쳐진다
    assert by_id["9"]["from"] == ["vec:e5-small", "vec:arctic-ko"]
    assert by_id["2"]["grade"] is None


def test_sheet_only_ungraded_drops_graded_rows():
    md = sheet(DOC, None, only_ungraded=True)
    assert "창덕궁" in md and "한복남" in md
    assert "경복궁" not in md


def test_stats_counts_graded_and_overlap():
    out = stats(DOC)
    assert "판정됨 2건" in out and "판정된 질의 1개" in out
    assert "e5-small 2" in out
