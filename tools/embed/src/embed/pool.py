"""판정 세트 풀링 — 후보 모델의 벡터 상위 k 를 judgments.yml 에 `vector_candidates` 로 덧붙인다.

BM25 후보만 판정하면 벡터가 새로 찾은 문서가 "판정 없음"으로 빠져 벡터 레그가 과소평가된다. 여러 시스템의 상위 k 를 합쳐(pooling)
사람이 한 번에 판정하게 한다. 이 코드는 grade 를 만들지 않는다 — 후보만 늘린다.

  python -m embed.pool run   --models e5-small,harrier-270m --lang ko --judgments judgments.yml --out-dir pool/ [--limit 300]
  python -m embed.pool merge --judgments judgments.yml --pools pool/*.json --out judgments.yml
"""
from __future__ import annotations

import argparse
import glob
import json
import time
from pathlib import Path

import numpy as np
import yaml

from . import bakeoff, models


def run_pool(model_keys: list[str], lang: str, judgments_path: str, out_dir: str, *, base_url: str = "https://api.1989v.com",
             limit: int | None = None, device: str | None = None, k: int = 10, corpus_cache: str | None = None) -> None:
    out = Path(out_dir); out.mkdir(parents=True, exist_ok=True)
    cache = Path(corpus_cache or out / f"corpus_{lang}.json")
    if cache.exists():
        attractions = json.loads(cache.read_text(encoding="utf-8"))
    else:
        attractions = bakeoff.fetch_attractions(base_url, lang=lang, limit=limit)
        cache.write_text(json.dumps(attractions, ensure_ascii=False), encoding="utf-8")
    judgments = [q for q in bakeoff.load_judgments(judgments_path) if q.get("lang", "ko") == lang]
    q_texts = [q["query"] for q in judgments]
    for key in model_keys:
        spec = models.resolve_revision(models.CANDIDATES[key])
        t0 = time.time()
        model = bakeoff.load_model(spec, device=device)
        corpus = bakeoff.build_corpus(attractions, "full", spec.ref)
        d = bakeoff.encode(model, corpus.texts, prompt=spec.doc_prompt, dim=spec.native_dim)
        enc_s = time.time() - t0
        qv = bakeoff.encode(model, q_texts, prompt=spec.query_prompt, dim=spec.native_dim)
        idx = bakeoff.top_k(qv, d, k)
        per_query = {q["query"]: [{"id": corpus.ids[j], "title": corpus.meta[j]["title"], "category": corpus.meta[j]["category"],
                                   "address": corpus.meta[j].get("address"), "score": round(float(qv[qi] @ d[j]), 4)}
                                  for j in idx[qi]] for qi, q in enumerate(judgments)}
        (out / f"pool_{lang}_{key}.json").write_text(json.dumps({
            "model": key, "model_ref": spec.ref, "lang": lang, "docs": len(corpus.ids), "encode_s": round(enc_s, 1),
            "docs_per_s": round(len(corpus.ids) / max(enc_s, 1e-9), 1), "per_query": per_query}, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"{key}: {len(corpus.ids)} docs in {enc_s:.0f}s ({len(corpus.ids)/max(enc_s,1e-9):.0f} docs/s) → pool_{lang}_{key}.json")
        # `del` 만으로는 가속기 메모리가 안 돌아온다 — torch 가 할당자 캐시를 붙들고 있다.
        # 다음 모델을 그 위에 올리면 두 벌이 겹쳐 죽는다 (2026-09-06: 4B 다음 8B 에서 OOM 으로 프로세스 종료).
        del model
        _release_accelerator()


def _release_accelerator() -> None:
    """모델 사이에 가속기 캐시를 비운다. 실패해도 진행한다(디바이스가 없을 수도 있다)."""
    import gc
    gc.collect()
    try:
        import torch
        if torch.backends.mps.is_available():
            torch.mps.empty_cache()
        elif torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:  # torch 가 없거나(테스트 환경) 백엔드가 없으면 그냥 넘어간다
        pass


def merge_pools(judgments: list[dict], pools: list[dict]) -> list[dict]:
    """각 질의에 `vector_candidates` 를 만든다 — BM25 후보에 없는 id 만, 모델 간 중복은 `models` 로 합친다. grade 는 null 로 둔다(기존 값은 보존)."""
    for q in judgments:
        bm25_ids = {str(c["id"]) for c in q.get("candidates", [])}
        existing = {str(c["id"]): c for c in q.get("vector_candidates", [])}
        merged: dict[str, dict] = dict(existing)
        for pool in pools:
            if pool.get("lang", "ko") != q.get("lang", "ko"):
                continue
            for rank, hit in enumerate(pool["per_query"].get(q["query"], []), start=1):
                hid = str(hit["id"])
                if hid in bm25_ids:
                    continue
                if hid in merged:
                    if pool["model"] not in merged[hid]["models"]:
                        merged[hid]["models"].append(pool["model"])
                    continue
                merged[hid] = {"id": hid, "title": hit["title"], "category": hit.get("category") or "", "address": hit.get("address") or "",
                               "models": [pool["model"]], "grade": None}
        q["vector_candidates"] = list(merged.values())
    return judgments


def write_judgments(path: str, doc_header: list[str], meta: dict, judgments: list[dict]) -> None:
    """생성기와 같은 모양(후보는 한 줄 flow 매핑)으로 다시 쓴다 — 사람이 grade 만 바꾸기 쉽게."""
    def q(v): return json.dumps(v, ensure_ascii=False)
    lines = list(doc_header)
    for k, v in meta.items():
        lines.append(f"{k}: {q(v) if isinstance(v, str) else json.dumps(v, ensure_ascii=False, default=str)}")
    lines.append("queries:")
    for item in judgments:
        lines.append(f"  - query: {q(item['query'])}")
        lines.append(f"    lang: {item.get('lang', 'ko')}")
        lines.append(f"    intent: {q(item.get('intent', ''))}")
        lines.append(f"    from: {item.get('from', 'intent-v0')}")
        if "bm25_total" in item:
            lines.append(f"    bm25_total: {item['bm25_total']}")
        lines.append("    candidates:")
        for c in item.get("candidates", []):
            by = f", by: {c['by']}" if c.get("by") else ""
            lines.append(f"      - {{id: {q(str(c['id']))}, title: {q(c['title'])}, category: {q(c.get('category') or '')}, address: {q(c.get('address') or '')}, grade: {json.dumps(c.get('grade'))}{by}}}")
        if item.get("vector_candidates"):
            lines.append("    vector_candidates:")
            for c in item["vector_candidates"]:
                by = f", by: {c['by']}" if c.get("by") else ""
                lines.append(f"      - {{id: {q(str(c['id']))}, title: {q(c['title'])}, category: {q(c.get('category') or '')}, address: {q(c.get('address') or '')}, models: {json.dumps(c.get('models', []), ensure_ascii=False)}, grade: {json.dumps(c.get('grade'))}{by}}}")
    Path(path).write_text("\n".join(lines) + "\n", encoding="utf-8")


HEADER = [
    "# 통합 검색 판정 세트 v0 (2026-09-05) — 검사의 근거는 검사 밖에 있어야 한다. grade 는 사람이 적는다.",
    "# grade: 3 = 정확히 원하던 것 · 2 = 관련 · 1 = 약하게 관련 · 0 = 무관 · null = 미판정.",
    "# candidates 는 2026-09-05 운영 /api/search/attractions 의 BM25 상위 10 (lang 별). vector_candidates 는 후보 모델의 벡터 상위 10 중",
    "# BM25 후보에 없던 문서(models 에 어느 모델이 찾았는지). 판정이 없는 질의는 nDCG 계산에서 빠진다(자동으로 정답을 만들지 않는다).",
    "# by: human = 사람이 매긴 것 · llm = LLM 초안(검토 대상). 출처를 남겨야 '이 nDCG 는 무엇 기준인가'에 답할 수 있다.",
]


def main() -> None:
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run"); r.add_argument("--models", required=True); r.add_argument("--lang", default="ko")
    r.add_argument("--judgments", required=True); r.add_argument("--out-dir", required=True); r.add_argument("--limit", type=int)
    r.add_argument("--device"); r.add_argument("--base-url", default="https://api.1989v.com")
    m = sub.add_parser("merge"); m.add_argument("--judgments", required=True); m.add_argument("--pools", nargs="+", required=True); m.add_argument("--out", required=True)
    a = ap.parse_args()
    if a.cmd == "run":
        run_pool(a.models.split(","), a.lang, a.judgments, a.out_dir, base_url=a.base_url, limit=a.limit, device=a.device)
    else:
        doc = yaml.safe_load(open(a.judgments, encoding="utf-8"))
        pools = [json.loads(open(p, encoding="utf-8").read()) for pat in a.pools for p in sorted(glob.glob(pat))]
        merged = merge_pools(doc["queries"], pools)
        meta = {k: v for k, v in doc.items() if k != "queries"}
        write_judgments(a.out, HEADER, meta, merged)
        added = sum(len(q.get("vector_candidates", [])) for q in merged)
        print(f"merged {len(pools)} pools → {added} vector candidates over {len(merged)} queries → {a.out}")


if __name__ == "__main__":
    main()
