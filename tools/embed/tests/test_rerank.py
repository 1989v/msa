from embed.rerank import candidate_docs

CORPUS = {"1": {"id": 1, "title": "경복궁"}, "2": {"id": 2, "title": "한복남"}, "9": {"id": 9, "title": "창덕궁"}}
JUDG = [
    {"query": "궁궐", "lang": "ko", "candidates": [{"id": "1"}, {"id": "2"}],
     "vector_candidates": [{"id": "9"}, {"id": "1"}, {"id": "404"}]},
    {"query": "palace", "lang": "en", "candidates": [{"id": "2"}]},
]


def test_collects_unique_ids_across_both_lists_and_skips_missing():
    ids, docs = candidate_docs(JUDG, CORPUS, "ko")
    assert ids == ["1", "2", "9"]          # 중복 제거, 순서 유지
    assert "404" not in ids                # 코퍼스에 없는 id 는 건너뛴다
    assert [d["title"] for d in docs] == ["경복궁", "한복남", "창덕궁"]


def test_lang_filter_excludes_other_language_queries():
    ids, _ = candidate_docs(JUDG, CORPUS, "en")
    assert ids == ["2"]
