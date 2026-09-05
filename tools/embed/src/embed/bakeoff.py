"""P0 bake-off — 후보 모델 × 차원 × 텍스트 규칙을 판정 세트 nDCG@10 으로 한 표에 (플랜 P0-3).

Colab 노트북(notebooks/bakeoff.ipynb)이 이 모듈만 부른다. 판정(grade)은 사람이 judgments.yml 에 적는다 —
grade 가 없는 질의는 nDCG 에서 빠진다. 이 코드는 정답을 만들지 않는다.
"""
from __future__ import annotations

import math
import time
from dataclasses import dataclass
from typing import Callable, Iterable

import numpy as np
import requests
import yaml

from .embed_text import attraction_text, attraction_title_text, text_hash
from .models import ModelSpec

UA = {"User-Agent": "kgd-embed/0.1 (bake-off)", "Accept": "application/json"}

RULES: dict[str, Callable[..., str]] = {"full": attraction_text, "title": attraction_title_text}


def _get_json(url: str, params: dict, tries: int = 4) -> dict:
    """게이트웨이는 업스트림이 잠깐 죽어도 200 + 빈 바디를 내린다(k8s/CLAUDE.md). 상태코드만 믿지 않고 바디를 본다."""
    last = ""
    for attempt in range(tries):
        r = requests.get(url, params=params, headers=UA, timeout=60)
        if r.status_code == 200 and r.text.strip():
            try:
                return r.json()
            except ValueError:
                last = f"200 이지만 JSON 이 아니다: {r.text[:200]!r}"
        else:
            last = f"status={r.status_code} bytes={len(r.content)} body={r.text[:200]!r}"
        time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"{url} {params}: {tries}회 실패 — {last}")


def fetch_attractions(base_url: str, lang: str = "ko", limit: int | None = None, page_size: int = 100,
                      sleep: float = 0.05) -> list[dict]:
    """공개 API `GET /api/places/attractions?lang&page&size` 풀스캔. limit 은 스모크 테스트용."""
    out: list[dict] = []
    page = 0
    while True:
        data = _get_json(f"{base_url}/api/places/attractions", {"lang": lang, "page": page, "size": page_size})["data"]
        items = data.get("attractions", [])
        out.extend(a for a in items if a.get("status", "ACTIVE") == "ACTIVE")
        page += 1
        if limit and len(out) >= limit:
            return out[:limit]
        if page >= int(data.get("totalPages", 0)) or not items:
            return out
        time.sleep(sleep)


@dataclass
class Corpus:
    ids: list[str]
    texts: list[str]
    hashes: list[str]
    meta: list[dict]


def build_corpus(attractions: Iterable[dict], rule: str, model_ref: str) -> Corpus:
    fn = RULES[rule]
    ids, texts, hashes, meta = [], [], [], []
    for a in attractions:
        text = fn(title=a.get("titleDisplay") or a["title"], title_local=a.get("titleLocal"), category=a.get("category"),
                  address=a.get("address"), overview=a.get("overview"), lang=a.get("lang", "ko"))
        ids.append(str(a["id"])); texts.append(text); hashes.append(text_hash(model_ref, text))
        meta.append({"title": a.get("titleDisplay") or a["title"], "category": a.get("category"), "lang": a.get("lang")})
    return Corpus(ids, texts, hashes, meta)


def load_judgments(path_or_url: str) -> list[dict]:
    if path_or_url.startswith("http"):
        raw = requests.get(path_or_url, headers=UA, timeout=60).text
    else:
        raw = open(path_or_url, encoding="utf-8").read()
    doc = yaml.safe_load(raw)
    return doc["queries"]


def graded(query: dict) -> dict[str, int]:
    """id → grade (판정된 것만). 비어 있으면 이 질의는 평가에서 빠진다."""
    g: dict[str, int] = {}
    for c in query.get("candidates", []) + query.get("vector_candidates", []):
        if c.get("grade") is not None:
            g[str(c["id"])] = int(c["grade"])
    return g


def ndcg_at_k(ranked_ids: list[str], grades: dict[str, int], k: int = 10) -> float | None:
    if not grades or max(grades.values()) == 0:
        return None
    dcg = sum((2 ** grades.get(d, 0) - 1) / math.log2(i + 2) for i, d in enumerate(ranked_ids[:k]))
    ideal = sorted(grades.values(), reverse=True)[:k]
    idcg = sum((2 ** g - 1) / math.log2(i + 2) for i, g in enumerate(ideal))
    return dcg / idcg if idcg else None


def encode(model, texts: list[str], *, prompt: str | None, dim: int, batch_size: int = 64) -> np.ndarray:
    """sentence-transformers encode → L2 정규화 → MRL 자르기 → 재정규화. 반환 float32 (n, dim)."""
    vecs = model.encode(texts, prompt=prompt, batch_size=batch_size, normalize_embeddings=True,
                        convert_to_numpy=True, show_progress_bar=False).astype(np.float32)
    if vecs.shape[1] > dim:
        vecs = vecs[:, :dim]
        vecs /= np.maximum(np.linalg.norm(vecs, axis=1, keepdims=True), 1e-9)
    return vecs


def top_k(q: np.ndarray, d: np.ndarray, k: int = 10, chunk: int = 20000) -> np.ndarray:
    """코사인(정규화됐으니 내적) 상위 k 의 문서 인덱스, (nq, k)."""
    best_scores = np.full((q.shape[0], k), -np.inf, dtype=np.float32)
    best_idx = np.zeros((q.shape[0], k), dtype=np.int64)
    for start in range(0, d.shape[0], chunk):
        s = q @ d[start:start + chunk].T
        cand_scores = np.concatenate([best_scores, s], axis=1)
        cand_idx = np.concatenate([best_idx, np.arange(start, start + s.shape[1])[None, :].repeat(q.shape[0], 0)], axis=1)
        order = np.argsort(-cand_scores, axis=1)[:, :k]
        best_scores = np.take_along_axis(cand_scores, order, axis=1)
        best_idx = np.take_along_axis(cand_idx, order, axis=1)
    return best_idx


def load_model(spec: ModelSpec, device: str | None = None):
    from sentence_transformers import SentenceTransformer
    model_kwargs: dict = {}
    if spec.load_kwargs and spec.load_kwargs.get("quantize_8bit"):
        from transformers import BitsAndBytesConfig  # CUDA 전용 — Colab T4 에서 8B
        model_kwargs["quantization_config"] = BitsAndBytesConfig(load_in_8bit=True)
    elif device != "cpu":
        import torch
        model_kwargs["torch_dtype"] = torch.float16
    return SentenceTransformer(spec.hf_id, revision=spec.revision, device=device, model_kwargs=model_kwargs or None,
                               trust_remote_code=False)


def evaluate(spec: ModelSpec, model, attractions: list[dict], judgments: list[dict], *, dims: list[int],
             rules: list[str] = ("full", "title"), k: int = 10, lang_filter: str | None = None) -> tuple[list[dict], dict]:
    """한 모델에 대해 차원 × 규칙 조합의 nDCG@10 평균과 질의별 상위 k 를 낸다. 인코딩은 native 차원에서 한 번만 하고 자른다."""
    rows: list[dict] = []
    per_query: dict = {}
    qs = [q for q in judgments if (lang_filter is None or q.get("lang", "ko") == lang_filter)]
    q_texts = [q["query"] for q in qs]
    q_vecs_full = encode(model, q_texts, prompt=spec.query_prompt, dim=spec.native_dim)
    for rule in rules:
        corpus = build_corpus(attractions, rule, spec.with_dim(spec.native_dim).ref if spec.revision else f"{spec.hf_id}@unknown#d{spec.native_dim}")
        t0 = time.time()
        d_vecs_full = encode(model, corpus.texts, prompt=spec.doc_prompt, dim=spec.native_dim)
        enc_s = time.time() - t0
        for dim in dims:
            if dim > spec.native_dim or (dim != spec.native_dim and not spec.mrl):
                continue
            dv = d_vecs_full[:, :dim].copy(); dv /= np.maximum(np.linalg.norm(dv, axis=1, keepdims=True), 1e-9)
            qv = q_vecs_full[:, :dim].copy(); qv /= np.maximum(np.linalg.norm(qv, axis=1, keepdims=True), 1e-9)
            idx = top_k(qv, dv, k)
            scores, judged = [], 0
            for qi, q in enumerate(qs):
                ranked = [corpus.ids[j] for j in idx[qi]]
                per_query[(spec.key, rule, dim, q["query"])] = [
                    {"id": corpus.ids[j], "title": corpus.meta[j]["title"], "category": corpus.meta[j]["category"]} for j in idx[qi]]
                n = ndcg_at_k(ranked, graded(q), k)
                if n is not None:
                    scores.append(n); judged += 1
            rows.append({"model": spec.key, "hf_id": spec.hf_id, "rule": rule, "dim": dim, "docs": len(corpus.ids),
                         "judged_queries": judged, f"ndcg@{k}": round(float(np.mean(scores)), 4) if scores else None,
                         "encode_docs_s": round(enc_s, 1)})
    return rows, per_query


def bm25_baseline(judgments: list[dict], k: int = 10) -> dict:
    """judgments.yml 의 BM25 상위 10 자체를 같은 잣대로 — 하이브리드 전/후의 '전'."""
    scores = []
    for q in judgments:
        ranked = [str(c["id"]) for c in q.get("candidates", [])]
        n = ndcg_at_k(ranked, graded(q), k)
        if n is not None:
            scores.append(n)
    return {"model": "bm25 (운영 2026-09-05)", "rule": "-", "dim": "-", "judged_queries": len(scores),
            f"ndcg@{k}": round(float(np.mean(scores)), 4) if scores else None}


def export_vectors(path: str, spec: ModelSpec, corpus: Corpus, vecs: np.ndarray) -> None:
    """첫 채움용 parquet — push --file 이 읽는다. (attraction_id, model_ref, dim, embedding_text, text_hash, vector)"""
    import pandas as pd
    df = pd.DataFrame({"attraction_id": [int(i) for i in corpus.ids], "model_ref": spec.ref, "dim": spec.dim,
                       "embedding_text": corpus.texts, "text_hash": corpus.hashes,
                       "vector": [v.astype(np.float32).tolist() for v in vecs]})
    df.to_parquet(path, index=False)
