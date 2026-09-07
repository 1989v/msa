"""P0 bake-off — 후보 모델 × 차원 × 텍스트 규칙을 판정 세트 nDCG@10 으로 한 표에 (플랜 P0-3).

Colab 노트북(notebooks/bakeoff.ipynb)이 이 모듈만 부른다. 판정(grade)은 사람이 judgments.yml 에 적는다 —
grade 가 없는 질의는 nDCG 에서 빠진다. 이 코드는 정답을 만들지 않는다.
"""
from __future__ import annotations

import math
import time
from pathlib import Path
from dataclasses import dataclass
from typing import Callable, Iterable

import numpy as np
import requests
import yaml

from .embed_text import (
    attraction_text,
    attraction_text_no_address,
    attraction_text_no_title,
    attraction_text_region,
    attraction_text_short,
    attraction_title_text,
    text_hash,
)
from .models import ModelSpec

UA = {"User-Agent": "kgd-embed/0.1 (bake-off)", "Accept": "application/json"}

#: 임베딩 텍스트 규칙. `full` 이 v1(운영 규칙)이고 나머지는 그것을 의심하는 변형이다.
#: **규칙을 바꾸면 모든 text_hash 가 어긋나 전량 재임베딩이 된다** — 비교는 오프라인에서만 한다.
RULES: dict[str, Callable[..., str]] = {
    "full": attraction_text,                    # v1 — 제목 · 분류 · 주소전체 · 개요 1000자
    "title": attraction_title_text,             # A — 이름만
    "no-address": attraction_text_no_address,   # B — 주소 제거
    "region": attraction_text_region,           # C — 주소를 시·구까지만
    "short": attraction_text_short,             # D — 개요 300자
    "no-title": attraction_text_no_title,       # E — 제목 제거(상호명 충돌 완화)
}


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


def corpus_ref(spec: ModelSpec) -> str:
    """평가용 코퍼스의 해시를 만드는 스탬프 — **native 차원**이다.

    인코딩은 native 에서 한 번만 하고 차원마다 잘라 재므로(evaluate), 해시도 native 스탬프로 만든다.
    배포 차원의 스탬프와 다르다 — 첫 채움 parquet 을 만들 때는 `embed.export` 가 다시 계산한다.
    """
    return spec.with_dim(spec.native_dim).ref if spec.revision else f"{spec.hf_id}@unknown#d{spec.native_dim}"


def build_corpus(attractions: Iterable[dict], rule: str, model_ref: str) -> Corpus:
    fn = RULES[rule]
    ids, texts, hashes, meta = [], [], [], []
    for a in attractions:
        text = fn(title=a.get("titleDisplay") or a["title"], title_local=a.get("titleLocal"), category=a.get("category"),
                  address=a.get("address"), overview=a.get("overview"), lang=a.get("lang", "ko"))
        ids.append(str(a["id"])); texts.append(text); hashes.append(text_hash(model_ref, text))
        meta.append({"title": a.get("titleDisplay") or a["title"], "category": a.get("category"), "lang": a.get("lang"), "address": a.get("address")})
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
    # NaN 은 조용히 퍼진다 — 검사하지 않으면 "모든 질의가 같은 문서를 1위로" 라는 그럴듯한 결과가 나온다
    # (2026-09-05: harrier-270m fp16/MPS 가 전부 NaN 이었는데 풀 파일이 정상처럼 생겼다).
    if not np.isfinite(vecs).all():
        raise RuntimeError(f"임베딩에 NaN/Inf 가 있다 ({np.isnan(vecs).sum()}개) — dtype/디바이스 조합을 의심한다(fp16_ok=False?)")
    if vecs.shape[1] > dim:
        vecs = vecs[:, :dim]
        vecs /= np.maximum(np.linalg.norm(vecs, axis=1, keepdims=True), 1e-9)
    return vecs


def top_k(q: np.ndarray, d: np.ndarray, k: int = 10, chunk: int = 20000) -> np.ndarray:
    """코사인(정규화됐으니 내적) 상위 k 의 문서 인덱스, (nq, k).

    **문서 수보다 k 가 크면 k 를 줄인다.** 안 그러면 초기 자리(-inf, 인덱스 0)가 남아
    0번 문서가 여러 번 반환되고, 그 문서의 이득이 중복 계산돼 **nDCG 가 1을 넘는다**
    (2026-09-07 검사가 2.899 를 잡았다). 전 코퍼스에서는 문서가 훨씬 많아 드러나지 않았다.
    """
    k = min(k, d.shape[0])
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
    # 8bit 양자화는 bitsandbytes 라 CUDA 에서만 된다. MPS·CPU 에서는 fp16 으로 내려간다
    # (8B fp16 = 약 16GB — 통합 메모리가 그만큼 있어야 한다).
    if spec.load_kwargs and spec.load_kwargs.get("quantize_8bit") and (device or "").startswith("cuda"):
        from transformers import BitsAndBytesConfig
        model_kwargs["quantization_config"] = BitsAndBytesConfig(load_in_8bit=True)
    elif device != "cpu" and spec.fp16_ok:
        import torch
        model_kwargs["torch_dtype"] = torch.float16
    else:
        # fp16 을 못 쓰는 모델은 **fp32 로 못 박는다.** 체크포인트가 bf16 이면 라이브러리가
        # 그대로 읽어 서버(fp32)와 정밀도가 갈리고, 같은 질의에 다른 벡터가 나온다.
        import torch
        model_kwargs["torch_dtype"] = torch.float32
    return SentenceTransformer(spec.hf_id, revision=spec.revision, device=device, model_kwargs=model_kwargs or None,
                               trust_remote_code=False)


def evaluate(spec: ModelSpec, model, attractions: list[dict], judgments: list[dict], *, dims: list[int],
             rules: list[str] = ("full", "title"), k: int = 10, lang_filter: str | None = None,
             on_encoded=None, batch_size: int = 64) -> tuple[list[dict], dict]:
    """한 모델에 대해 차원 × 규칙 조합의 nDCG@10 평균과 질의별 상위 k 를 낸다. 인코딩은 native 차원에서 한 번만 하고 자른다."""
    rows: list[dict] = []
    per_query: dict = {}
    qs = [q for q in judgments if (lang_filter is None or q.get("lang", "ko") == lang_filter)]
    q_texts = [q["query"] for q in qs]
    q_vecs_full = encode(model, q_texts, prompt=spec.query_prompt, dim=spec.native_dim, batch_size=batch_size)
    for rule in rules:
        corpus = build_corpus(attractions, rule, corpus_ref(spec))
        t0 = time.time()
        d_vecs_full = encode(model, corpus.texts, prompt=spec.doc_prompt, dim=spec.native_dim, batch_size=batch_size)
        enc_s = time.time() - t0
        # **인코딩이 이 함수에서 가장 비싼 일이다**(4B·4.5만 건 = 3시간). 평가 단계에서 죽으면
        # 그걸 통째로 잃는다 — 실제로 그랬다(2026-09-07). 계산에 들어가기 전에 먼저 넘겨준다.
        if on_encoded is not None:
            on_encoded(rule, corpus, d_vecs_full, enc_s)
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
                    {"id": corpus.ids[j], "title": corpus.meta[j]["title"], "category": corpus.meta[j]["category"],
                     "address": corpus.meta[j].get("address")} for j in idx[qi]]
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


def export_vectors(path: str, ref: str, dim: int, corpus: Corpus, vecs: np.ndarray) -> None:
    """첫 채움용 parquet — push --file 이 읽는다. (attraction_id, model_ref, dim, embedding_text, text_hash, vector)

    해시는 corpus 것을 그대로 쓴다. **corpus 를 만든 스탬프와 ref 가 같아야 한다** — 다르면
    push 의 검사가 막는다(그것이 이 계약이 지켜지는 방식이다).
    """
    import pandas as pd
    df = pd.DataFrame({"attraction_id": [int(i) for i in corpus.ids], "model_ref": ref, "dim": dim,
                       "embedding_text": corpus.texts, "text_hash": corpus.hashes,
                       "vector": [v.astype(np.float32).tolist() for v in vecs]})
    df.to_parquet(path, index=False)


def score_saved(vec_npz: str, query_npz: str, judgments_path: str, lang: str,
                dims: list[int], k: int = 10) -> list[dict]:
    """저장된 인코딩만으로 차원별 nDCG 를 낸다 — **모델을 부르지 않는다.**

    인코딩이 이 파이프라인에서 유일하게 비싼 일이라(4B·4.5만 건 = 3시간),
    한 번 저장해 두면 차원·k 를 바꿔 가며 재는 것은 초 단위가 된다.
    """
    dv_all = np.load(vec_npz, allow_pickle=True)
    qv_all = np.load(query_npz, allow_pickle=True)
    ids = [str(i) for i in dv_all["ids"]]
    d_full = dv_all["vectors"]
    q_full = qv_all["vectors"]
    queries = [str(q) for q in qv_all["queries"]]
    js = [q for q in load_judgments(judgments_path) if q.get("lang", "ko") == lang]
    order = {q: i for i, q in enumerate(queries)}
    rows = []
    for dim in dims:
        if dim > d_full.shape[1]:
            continue
        dv = d_full[:, :dim].copy(); dv /= np.maximum(np.linalg.norm(dv, axis=1, keepdims=True), 1e-9)
        qv = q_full[:, :dim].copy(); qv /= np.maximum(np.linalg.norm(qv, axis=1, keepdims=True), 1e-9)
        sel = [order[q["query"]] for q in js if q["query"] in order]
        used = [q for q in js if q["query"] in order]
        idx = top_k(qv[sel], dv, k)
        scores = []
        for qi, q in enumerate(used):
            n = ndcg_at_k([ids[j] for j in idx[qi]], graded(q), k)
            if n is not None:
                scores.append(n)
        rows.append({"dim": dim, "judged_queries": len(scores), "docs": len(ids),
                     f"ndcg@{k}": round(float(np.mean(scores)), 4) if scores else None})
    return rows


def main(argv: list[str] | None = None) -> int:
    """차원·규칙 비교 — **한 번 인코딩해 잘라서** 잰다(MRL). 차원마다 다시 돌리지 않는다.

      python -m embed.bakeoff --model qwen3-4b --lang ko --dims 512,1024 \
             --judgments docs/specs/2026-09-05-unified-search/judgments.yml \
             --corpus <scratchpad>/p0/pool/corpus_ko.json --device mps
    """
    import argparse
    import json as _json

    from . import models

    ap = argparse.ArgumentParser(prog="python -m embed.bakeoff", description="차원·텍스트 규칙 비교")
    ap.add_argument("--model", help="--score-saved 로 재채점할 때는 필요 없다")
    ap.add_argument("--judgments", required=True)
    ap.add_argument("--corpus", help="pool 이 캐시한 corpus_{lang}.json (--score-saved 면 불필요)")
    ap.add_argument("--lang", default="ko")
    ap.add_argument("--dims", default="512,1024", help="쉼표 구분")
    ap.add_argument("--rules", default="full", help="full | title | full,title")
    ap.add_argument("--device")
    ap.add_argument("--out", help="마크다운 표를 쓸 파일")
    ap.add_argument("--score-saved", nargs=2, metavar=("VEC_NPZ", "QVEC_NPZ"),
                    help="저장된 인코딩만으로 차원별 nDCG 를 다시 낸다. 모델을 부르지 않아 초 단위다")
    ap.add_argument("--batch-size", type=int, default=64,
                    help="인코딩 배치. 큰 모델(4B 이상)은 64 에서 통합 메모리를 넘겨 스왑으로 떨어진다 — 8~16 으로 낮춘다")
    ap.add_argument("--save-vectors", metavar="DIR",
                    help="인코딩 결과를 규칙마다 npz 로 저장한다. **평가 전에 쓴다** — "
                         "이걸 주면 계산 단계에서 죽어도 인코딩을 다시 하지 않는다. 첫 채움에도 그대로 쓴다")
    a = ap.parse_args(argv)

    dims_arg = [int(d) for d in a.dims.split(",")]
    if a.score_saved:  # 모델·코퍼스 없이 저장본만으로
        rows = score_saved(a.score_saved[0], a.score_saved[1], a.judgments, a.lang, dims_arg)
        out = f"# 차원 비교 (저장된 인코딩 재채점) — {a.lang}\n\n| 차원 | nDCG@10 | 판정된 질의 | 문서 |\n|---|---|---|---|\n"
        for r in rows:
            out += f"| {r['dim']} | {r['ndcg@10']} | {r['judged_queries']} | {r['docs']} |\n"
        print(out)
        if a.out: Path(a.out).write_text(out, encoding="utf-8"); print(f"→ {a.out}")
        return 0

    spec = models.resolve_revision(models.CANDIDATES[a.model])
    attractions = _json.loads(Path(a.corpus).read_text(encoding="utf-8"))
    judgments = load_judgments(a.judgments)
    dims = dims_arg
    rules = tuple(r.strip() for r in a.rules.split(",") if r.strip())

    saved: list[str] = []

    def save(rule, corpus, vecs, enc_s):
        if not a.save_vectors:
            return
        d = Path(a.save_vectors); d.mkdir(parents=True, exist_ok=True)
        f = d / f"vec_{a.lang}_{a.model}_{rule}.npz"
        np.savez_compressed(f, vectors=vecs.astype(np.float32),
                            ids=np.array(corpus.ids), hashes=np.array(corpus.hashes),
                            texts=np.array(corpus.texts, dtype=object), model_ref=corpus_ref(spec), encode_s=enc_s)
        saved.append(str(f))
        print(f"  인코딩 저장 → {f}  ({vecs.shape[0]}건 · {enc_s:.0f}초)", flush=True)

    model = load_model(spec, device=a.device)
    if a.save_vectors:  # 질의는 싸다 — 문서와 함께 저장해 두면 나중에 모델 없이 재계산할 수 있다
        d = Path(a.save_vectors); d.mkdir(parents=True, exist_ok=True)
        qs = [q["query"] for q in judgments if q.get("lang", "ko") == a.lang]
        qv = encode(model, qs, prompt=spec.query_prompt, dim=spec.native_dim, batch_size=a.batch_size)
        np.savez_compressed(d / f"qvec_{a.lang}_{a.model}.npz", vectors=qv.astype(np.float32),
                            queries=np.array(qs, dtype=object), model_ref=spec.ref)
        print(f"  질의 인코딩 저장 → qvec_{a.lang}_{a.model}.npz ({len(qs)}건)", flush=True)
    rows, _ = evaluate(spec, model, attractions, judgments, dims=dims, rules=rules,
                       lang_filter=a.lang, on_encoded=save, batch_size=a.batch_size)

    header = f"# 차원 비교 — {spec.ref} ({a.lang}, 질의 {rows[0]['judged_queries'] if rows else 0}개)\n\n"
    header += "**한 번 인코딩해 MRL 로 잘라 비교한다** — 차원마다 다시 돌린 값이 아니다.\n\n"
    table = "| 규칙 | 차원 | nDCG@10 | 판정된 질의 | 문서 | 인코딩 |\n|---|---|---|---|---|---|\n"
    for r in rows:
        table += f"| {r['rule']} | {r['dim']} | {r['ndcg@10']} | {r['judged_queries']} | {r['docs']} | {r['encode_docs_s']}초 |\n"
    out = header + table
    if saved:
        out += "\n인코딩 저장: " + " · ".join(f"`{s.rsplit('/',1)[-1]}`" for s in saved) + "\n"
    print(out)
    if a.out:
        Path(a.out).write_text(out, encoding="utf-8")
        print(f"→ {a.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
