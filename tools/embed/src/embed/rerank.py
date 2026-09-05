"""후보 재순위 비교 — 판정 세트의 후보만 인코딩해 모델이 그것들을 어떻게 줄 세우는지 본다 (P0-3 보조).

전 코퍼스 풀링(`embed.pool`)이 감당 안 되는 큰 모델(Qwen3-4B/8B 등)을 위한 경로다. **새로 찾는 문서는 못 보지만**
"이미 모인 후보 중 좋은 것을 위로 올리는가"는 잴 수 있고, 판정이 있으면 그대로 nDCG@10 이 된다.

  python -m embed.rerank --models qwen3-8b --judgments judgments.yml --lang ko --out rerank_qwen3-8b.json
"""
from __future__ import annotations

import argparse
import json
import time

import numpy as np

from . import bakeoff, models


def candidate_docs(judgments: list[dict], corpus_by_id: dict[str, dict], lang: str) -> tuple[list[str], list[dict]]:
    """판정 세트에 등장하는 모든 후보 id(BM25 + 벡터) → 원본 문서. 코퍼스에 없는 id 는 건너뛴다."""
    ids: list[str] = []
    for q in judgments:
        if q.get("lang", "ko") != lang:
            continue
        for c in q.get("candidates", []) + q.get("vector_candidates", []):
            cid = str(c["id"])
            if cid not in ids and cid in corpus_by_id:
                ids.append(cid)
    return ids, [corpus_by_id[i] for i in ids]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", required=True)
    ap.add_argument("--judgments", required=True)
    ap.add_argument("--corpus", required=True, help="pool 이 캐시한 corpus_{lang}.json")
    ap.add_argument("--lang", default="ko")
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--device")
    ap.add_argument("--batch-size", type=int, default=8)
    ap.add_argument("--k", type=int, default=10)
    a = ap.parse_args()

    corpus_by_id = {str(d["id"]): d for d in json.loads(open(a.corpus, encoding="utf-8").read())}
    judgments = [q for q in bakeoff.load_judgments(a.judgments) if q.get("lang", "ko") == a.lang]
    ids, docs = candidate_docs(judgments, corpus_by_id, a.lang)
    print(f"{a.lang}: 질의 {len(judgments)} · 후보 문서 {len(ids)}건 (코퍼스 {len(corpus_by_id)} 중)")

    for key in a.models.split(","):
        spec = models.resolve_revision(models.CANDIDATES[key])
        t0 = time.time()
        model = bakeoff.load_model(spec, device=a.device)
        corpus = bakeoff.build_corpus(docs, "full", spec.ref)
        d = bakeoff.encode(model, corpus.texts, prompt=spec.doc_prompt, dim=spec.native_dim, batch_size=a.batch_size)
        qv = bakeoff.encode(model, [q["query"] for q in judgments], prompt=spec.query_prompt, dim=spec.native_dim,
                            batch_size=a.batch_size)
        elapsed = time.time() - t0
        per_query = {}
        for qi, q in enumerate(judgments):
            order = np.argsort(-(qv[qi] @ d.T))[:a.k]
            per_query[q["query"]] = [{"id": corpus.ids[j], "title": corpus.meta[j]["title"],
                                      "category": corpus.meta[j]["category"],
                                      "score": round(float(qv[qi] @ d[j]), 4)} for j in order]
        out = f"{a.out_dir}/rerank_{a.lang}_{key}.json"
        open(out, "w", encoding="utf-8").write(json.dumps(
            {"model": key, "model_ref": spec.ref, "lang": a.lang, "mode": "rerank-candidates",
             "docs": len(corpus.ids), "elapsed_s": round(elapsed, 1), "per_query": per_query}, ensure_ascii=False, indent=1))
        print(f"{key}: {len(corpus.ids)}건 {elapsed:.0f}초 → {out}")
        del model


if __name__ == "__main__":
    main()
