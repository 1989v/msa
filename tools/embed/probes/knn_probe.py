"""P0-4 — k-NN 메모리·지연 프로브. 정규화 난수 벡터를 문서(knn_vector)·사전(float, index:false) 인덱스에 넣고 잰다.

  python knn_probe.py --url http://localhost:9200 --dim 512 --docs 60000 --queries 80000
결과는 JSON 한 줄. 컨테이너 RSS 는 셸(run_probe.sh)이 docker stats 로 따로 읽는다.
"""
from __future__ import annotations

import argparse
import json
import time

import numpy as np
import requests


def put_index(url: str, name: str, body: dict) -> None:
    requests.delete(f"{url}/{name}", timeout=30)
    r = requests.put(f"{url}/{name}", json=body, timeout=60)
    r.raise_for_status()


def bulk(url: str, name: str, ids: range, vecs: np.ndarray, field: str, extra=None) -> None:
    lines = []
    for i, v in zip(ids, vecs):
        lines.append(json.dumps({"index": {"_index": name, "_id": str(i)}}))
        doc = {field: v.tolist()}
        if extra:
            doc.update(extra(i))
        lines.append(json.dumps(doc))
    r = requests.post(f"{url}/_bulk", data="\n".join(lines) + "\n",
                      headers={"Content-Type": "application/x-ndjson"}, timeout=300)
    r.raise_for_status()
    if r.json().get("errors"):
        raise RuntimeError(r.text[:500])


def unit(rng, n: int, dim: int) -> np.ndarray:
    v = rng.standard_normal((n, dim), dtype=np.float32)
    return v / np.linalg.norm(v, axis=1, keepdims=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://localhost:9200")
    ap.add_argument("--dim", type=int, default=512)
    ap.add_argument("--docs", type=int, default=60000)
    ap.add_argument("--queries", type=int, default=80000)
    ap.add_argument("--batch", type=int, default=1000)
    ap.add_argument("--knn-queries", type=int, default=200)
    ap.add_argument("--cleanup", action="store_true")
    a = ap.parse_args()
    rng = np.random.default_rng(42)
    docs_idx, qv_idx = f"probe_docs_{a.dim}", f"probe_qv_{a.dim}"

    put_index(a.url, docs_idx, {
        "settings": {"index": {"knn": True, "number_of_shards": 1, "number_of_replicas": 0, "refresh_interval": "-1"}},
        "mappings": {"properties": {
            "embedding": {"type": "knn_vector", "dimension": a.dim, "space_type": "cosinesimil",
                          "method": {"name": "hnsw", "engine": "lucene", "parameters": {"m": 16, "ef_construction": 128}}},
            "category": {"type": "keyword"}, "lang": {"type": "keyword"}}}})
    put_index(a.url, qv_idx, {
        "settings": {"index": {"number_of_shards": 1, "number_of_replicas": 0, "refresh_interval": "-1"}},
        "mappings": {"dynamic": "strict", "properties": {
            "vector": {"type": "float", "index": False, "doc_values": False}, "modelRef": {"type": "keyword"}}}})

    cats = ["nature", "history", "culture", "leisure", "shopping", "food", "stay"]
    t0 = time.time()
    for start in range(0, a.docs, a.batch):
        n = min(a.batch, a.docs - start)
        bulk(a.url, docs_idx, range(start, start + n), unit(rng, n, a.dim), "embedding",
             extra=lambda i: {"category": cats[i % 7], "lang": "ko" if i % 4 else "en"})
    docs_load_s = time.time() - t0
    t0 = time.time()
    for start in range(0, a.queries, a.batch):
        n = min(a.batch, a.queries - start)
        bulk(a.url, qv_idx, range(start, start + n), unit(rng, n, a.dim), "vector", extra=lambda i: {"modelRef": "probe"})
    qv_load_s = time.time() - t0
    for idx in (docs_idx, qv_idx):
        requests.post(f"{a.url}/{idx}/_refresh", timeout=120).raise_for_status()
    t0 = time.time()
    requests.post(f"{a.url}/{docs_idx}/_forcemerge?max_num_segments=1", timeout=1800).raise_for_status()
    merge_s = time.time() - t0

    # 워밍업 + 지연
    qs = unit(rng, a.knn_queries + 20, a.dim)
    lat = []
    for i, q in enumerate(qs):
        body = {"size": 10, "_source": False,
                "query": {"knn": {"embedding": {"vector": q.tolist(), "k": 100,
                                                  "filter": {"term": {"lang": "ko"}}}}}}
        t = time.perf_counter()
        r = requests.post(f"{a.url}/{docs_idx}/_search", json=body, timeout=60)
        r.raise_for_status()
        if i >= 20:
            lat.append((time.perf_counter() - t) * 1000)
    lat.sort()
    get_lat = []
    for i in range(200):
        t = time.perf_counter()
        requests.get(f"{a.url}/{qv_idx}/_doc/{i}", timeout=30).raise_for_status()
        get_lat.append((time.perf_counter() - t) * 1000)
    get_lat.sort()

    cat = requests.get(f"{a.url}/_cat/indices/probe_*?format=json&bytes=mb", timeout=30).json()
    stats = requests.get(f"{a.url}/_nodes/stats/jvm,os,indices/segments", timeout=30).json()
    node = next(iter(stats["nodes"].values()))
    out = {
        "dim": a.dim, "docs": a.docs, "queries_dict": a.queries,
        "store_mb": {c["index"]: float(c["store.size"]) for c in cat},
        "docs_load_s": round(docs_load_s, 1), "qv_load_s": round(qv_load_s, 1), "forcemerge_s": round(merge_s, 1),
        "knn_ms": {"p50": round(lat[len(lat) // 2], 1), "p95": round(lat[int(len(lat) * 0.95) - 1], 1), "p99": round(lat[int(len(lat) * 0.99) - 1], 1)},
        "dict_get_ms": {"p50": round(get_lat[100], 2), "p95": round(get_lat[189], 2)},
        "jvm_heap_used_mb": node["jvm"]["mem"]["heap_used_in_bytes"] // 2**20,
        "jvm_heap_max_mb": node["jvm"]["mem"]["heap_max_in_bytes"] // 2**20,
        "segments_memory_mb": node["indices"]["segments"].get("memory_in_bytes", 0) // 2**20,
        "os_mem_used_pct": node["os"]["mem"].get("used_percent"),
    }
    print(json.dumps(out, ensure_ascii=False))
    if a.cleanup:
        for idx in (docs_idx, qv_idx):
            requests.delete(f"{a.url}/{idx}", timeout=60)


if __name__ == "__main__":
    main()
