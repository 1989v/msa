"""P0-5 — OpenSearch 3.3.0 에서 플랜 §2.5 의 질의 모양이 실제로 먹는지 확인한다.

케이스: (1) hybrid[bool, knn] 기본 (2) hybrid[function_score(bool), function_score(knn)] (3) hybrid + sort [_score, idSort]
(4) from/size + pagination_depth (5) knn.filter (6) hybrid_score_explanation (7) _source.excludes.
각 케이스는 PASS/FAIL 과 서버 메시지 앞부분을 찍는다. 판정은 사람이 읽는다.
"""
from __future__ import annotations

import argparse
import json

import numpy as np
import requests

DIM = 64


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:9200")
    a = ap.parse_args()
    url, idx = a.url, "spike"
    rng = np.random.default_rng(7)
    requests.delete(f"{url}/{idx}", timeout=30)
    requests.put(f"{url}/{idx}", json={
        "settings": {"index": {"knn": True, "number_of_shards": 1, "number_of_replicas": 0}},
        "mappings": {"properties": {
            "title": {"type": "text"}, "category": {"type": "keyword"}, "lang": {"type": "keyword"}, "idSort": {"type": "long"},
            "embedding": {"type": "knn_vector", "dimension": DIM, "space_type": "cosinesimil",
                          "method": {"name": "hnsw", "engine": "lucene", "parameters": {"m": 16, "ef_construction": 128}}}}}},
        timeout=60).raise_for_status()
    titles = ["palace seoul", "palace suwon", "hanok village", "beach busan", "temple gyeongju", "market seoul", "restaurant hanok"]
    cats = ["history", "history", "culture", "nature", "history", "shopping", "food"]
    lines = []
    for i in range(2000):
        v = rng.standard_normal(DIM).astype(np.float32); v /= np.linalg.norm(v)
        lines.append(json.dumps({"index": {"_index": idx, "_id": str(i)}}))
        lines.append(json.dumps({"title": f"{titles[i % 7]} {i}", "category": cats[i % 7], "lang": "ko" if i % 3 else "en",
                                 "idSort": i, "embedding": v.tolist()}))
    r = requests.post(f"{url}/_bulk?refresh=true", data="\n".join(lines) + "\n",
                      headers={"Content-Type": "application/x-ndjson"}, timeout=300)
    r.raise_for_status(); assert not r.json().get("errors"), r.text[:300]

    # search pipelines
    requests.put(f"{url}/_search/pipeline/hybrid-rrf", json={
        "phase_results_processors": [{"score-ranker-processor": {"combination": {"technique": "rrf", "rank_constant": 60}}}]},
        timeout=30).raise_for_status()
    requests.put(f"{url}/_search/pipeline/hybrid-minmax", json={
        "phase_results_processors": [{"normalization-processor": {
            "normalization": {"technique": "min_max"},
            "combination": {"technique": "arithmetic_mean", "parameters": {"weights": [0.7, 0.3]}}}}]},
        timeout=30).raise_for_status()
    requests.put(f"{url}/_search/pipeline/hybrid-rrf-explain", json={
        "phase_results_processors": [{"score-ranker-processor": {"combination": {"technique": "rrf", "rank_constant": 60}}}],
        "response_processors": [{"hybrid_score_explanation": {}}]}, timeout=30).raise_for_status()

    qv = rng.standard_normal(DIM).astype(np.float32); qv /= np.linalg.norm(qv)
    bm25 = {"bool": {"must": [{"match": {"title": "palace"}}], "filter": [{"term": {"lang": "ko"}}]}}
    fs_bm25 = {"function_score": {"query": bm25, "functions": [{"filter": {"terms": {"category": ["history", "culture"]}}, "weight": 3.0}],
                                  "score_mode": "multiply", "boost_mode": "multiply"}}
    knn = {"knn": {"embedding": {"vector": qv.tolist(), "k": 50, "filter": {"term": {"lang": "ko"}}}}}
    fs_knn = {"function_score": {"query": knn, "functions": [{"filter": {"terms": {"category": ["history", "culture"]}}, "weight": 3.0}],
                                 "score_mode": "multiply", "boost_mode": "multiply"}}

    def run(name, params, body):
        r = requests.post(f"{url}/{idx}/_search", params=params, json=body, timeout=60)
        ok = r.status_code == 200
        hits = r.json().get("hits", {}).get("hits", []) if ok else []
        msg = "" if ok else r.text[:220].replace("\n", " ")
        extra = ""
        if ok and hits:
            extra = f" hits={len(hits)} top={hits[0].get('_id')} score={hits[0].get('_score')}"
            if "sort" in hits[0]:
                extra += f" sort={hits[0]['sort']}"
            if "_explanation" in hits[0]:
                extra += " explanation=yes"
            if hits[0].get("_source") is not None:
                extra += f" source_keys={sorted(hits[0]['_source'].keys())}"
        print(f"[{ 'PASS' if ok else 'FAIL'}] {name}{extra} {msg}")
        return r

    run("1 hybrid[bool, knn] + rrf", {"search_pipeline": "hybrid-rrf"}, {"size": 5, "query": {"hybrid": {"queries": [bm25, knn]}}})
    run("1b hybrid[bool, knn] + minmax weights", {"search_pipeline": "hybrid-minmax"}, {"size": 5, "query": {"hybrid": {"queries": [bm25, knn]}}})
    run("2 hybrid[function_score(bool), function_score(knn)]", {"search_pipeline": "hybrid-rrf"},
        {"size": 5, "query": {"hybrid": {"queries": [fs_bm25, fs_knn]}}})
    run("3 hybrid + sort [_score desc, idSort asc]", {"search_pipeline": "hybrid-rrf"},
        {"size": 5, "query": {"hybrid": {"queries": [bm25, knn]}}, "sort": [{"_score": "desc"}, {"idSort": "asc"}]})
    run("4 hybrid from=10 size=10 pagination_depth=100", {"search_pipeline": "hybrid-rrf"},
        {"from": 10, "size": 10, "query": {"hybrid": {"pagination_depth": 100, "queries": [bm25, knn]}}})
    run("5 knn.filter only (no hybrid)", {}, {"size": 5, "query": knn})
    run("6 hybrid + hybrid_score_explanation (explain=true)", {"search_pipeline": "hybrid-rrf-explain", "explain": "true"},
        {"size": 3, "query": {"hybrid": {"queries": [bm25, knn]}}})
    run("7 hybrid + _source.excludes embedding", {"search_pipeline": "hybrid-rrf"},
        {"size": 3, "_source": {"excludes": ["embedding"]}, "query": {"hybrid": {"queries": [bm25, knn]}}})
    run("8 hybrid with only bm25 leg (miss fallback shape)", {"search_pipeline": "hybrid-rrf"},
        {"size": 5, "query": {"hybrid": {"queries": [fs_bm25]}}})
    requests.delete(f"{url}/{idx}", timeout=30)


if __name__ == "__main__":
    main()
