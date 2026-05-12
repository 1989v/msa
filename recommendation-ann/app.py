"""
ADR-0046 / 0047 — Recommendation ANN sidecar (Python FastAPI + FAISS + ONNX Runtime).

학습 자료: study/docs/20-recommendation-modeling/24-msa-two-tower-ann.md + 12-paper-wide-and-deep.md

흐름:
1. 시작 시 ONNX user_tower + item_embeddings.npy + (선택) ranker.onnx + item_metadata.npy 로드
2. POST /search  → user_id → user_tower → FAISS HNSW Top-K (Phase 3 retrieval)
3. POST /rank    → user_id + candidate item_ids → Wide & Deep score → 재정렬 (Phase 4 ranking)
4. POST /reindex → 모든 모델/인덱스 atomic swap

FAISS HNSW 파라미터 (학습 §10 §3-2):
- M = 16 / ef_construction = 200 / ef_search = 100

PoC 단순화: retrieval + ranking 모델이 같은 sidecar. 향후 latency 분리 필요 시 별도 service.
"""
import logging
import os
import threading
from contextlib import asynccontextmanager
from pathlib import Path

import faiss
import numpy as np
import onnxruntime as ort
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

MODELS_DIR = Path(os.environ.get("MODELS_DIR", "/models"))
HNSW_M = int(os.environ.get("HNSW_M", "16"))
HNSW_EF_CONSTRUCTION = int(os.environ.get("HNSW_EF_CONSTRUCTION", "200"))
HNSW_EF_SEARCH = int(os.environ.get("HNSW_EF_SEARCH", "100"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("recommendation-ann")


class _State:
    """In-memory models + index. Atomic swap on reindex."""

    def __init__(self):
        # Retrieval
        self.user_session: ort.InferenceSession | None = None
        self.item_embeddings: np.ndarray | None = None
        self.item_ids: np.ndarray | None = None
        self.index: faiss.Index | None = None
        # Ranking (optional — degraded mode 시 None)
        self.ranker_session: ort.InferenceSession | None = None
        self.item_meta_lookup: dict[int, tuple[int, int]] = {}
        self.user_city_lookup: dict[int, int] = {}
        self.lock = threading.RLock()

    def load(self):
        log.info(f"Loading models from {MODELS_DIR}...")
        # ---- Retrieval (Two-Tower) ----
        user_onnx = MODELS_DIR / "user_tower.onnx"
        item_emb = MODELS_DIR / "item_embeddings.npy"
        item_ids = MODELS_DIR / "item_ids.npy"

        new_user_session: ort.InferenceSession | None = None
        new_embeddings: np.ndarray | None = None
        new_ids: np.ndarray | None = None
        new_index: faiss.Index | None = None

        if user_onnx.exists() and item_emb.exists() and item_ids.exists():
            new_user_session = ort.InferenceSession(str(user_onnx), providers=["CPUExecutionProvider"])
            new_embeddings = np.load(item_emb).astype("float32")
            new_ids = np.load(item_ids)
            dim = new_embeddings.shape[1]
            new_index = faiss.IndexHNSWFlat(dim, HNSW_M, faiss.METRIC_INNER_PRODUCT)
            new_index.hnsw.efConstruction = HNSW_EF_CONSTRUCTION
            new_index.add(new_embeddings)
            new_index.hnsw.efSearch = HNSW_EF_SEARCH
            log.info(
                f"Retrieval ready: items={new_embeddings.shape[0]} dim={dim} "
                f"hnsw(M={HNSW_M}, efC={HNSW_EF_CONSTRUCTION}, efS={HNSW_EF_SEARCH})"
            )
        else:
            log.warning("Retrieval models not found — /search will return empty")

        # ---- Ranking (Wide & Deep) ----
        ranker_onnx = MODELS_DIR / "ranker.onnx"
        item_meta = MODELS_DIR / "item_metadata.npy"
        new_ranker_session: ort.InferenceSession | None = None
        new_meta_lookup: dict[int, tuple[int, int]] = {}
        if ranker_onnx.exists() and item_meta.exists():
            new_ranker_session = ort.InferenceSession(str(ranker_onnx), providers=["CPUExecutionProvider"])
            meta = np.load(item_meta)  # (N, 3) — [item_id, city_id, category_id]
            for row in meta:
                new_meta_lookup[int(row[0])] = (int(row[1]), int(row[2]))
            log.info(f"Ranking ready: {len(new_meta_lookup)} item metadata")
        else:
            log.warning("Ranker not found — /rank will return identity (no re-ranking)")

        with self.lock:
            self.user_session = new_user_session
            self.item_embeddings = new_embeddings
            self.item_ids = new_ids
            self.index = new_index
            self.ranker_session = new_ranker_session
            self.item_meta_lookup = new_meta_lookup

    def retrieval_ready(self) -> bool:
        return self.user_session is not None and self.index is not None

    def ranking_ready(self) -> bool:
        return self.ranker_session is not None and bool(self.item_meta_lookup)


state = _State()


@asynccontextmanager
async def lifespan(_app: FastAPI):
    state.load()
    yield


app = FastAPI(title="recommendation-ann", lifespan=lifespan)


class SearchRequest(BaseModel):
    user_id: int
    k: int = 20


class SearchResponse(BaseModel):
    itemIds: list[int]
    scores: list[float]


class RankRequest(BaseModel):
    user_id: int
    user_city: int = 0  # 0 = unknown
    candidate_item_ids: list[int]
    k: int = 20


class RankResponse(BaseModel):
    itemIds: list[int]
    scores: list[float]


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok" if state.retrieval_ready() else "degraded",
        "retrieval_ready": state.retrieval_ready(),
        "ranking_ready": state.ranking_ready(),
        "n_items": int(state.item_embeddings.shape[0]) if state.retrieval_ready() else 0,
        "n_ranker_meta": len(state.item_meta_lookup),
    }


@app.get("/actuator/health/liveness")
def liveness():
    return {"status": "ok"}


@app.get("/actuator/health/readiness")
def readiness():
    return {"status": "ok" if state.retrieval_ready() else "degraded"}


@app.post("/search", response_model=SearchResponse)
def search(req: SearchRequest):
    if not state.retrieval_ready():
        return SearchResponse(itemIds=[], scores=[])
    if req.k <= 0 or req.k > 1000:
        raise HTTPException(status_code=400, detail="k must be in [1, 1000]")

    with state.lock:
        session = state.user_session
        index = state.index
        item_ids = state.item_ids

    try:
        user_emb = session.run(
            ["user_embedding"],
            {"user_id": np.array([req.user_id], dtype=np.int64)},
        )[0]
    except Exception as e:
        log.warning(f"ONNX retrieval inference failed: {e}")
        return SearchResponse(itemIds=[], scores=[])

    distances, indices = index.search(user_emb.astype("float32"), req.k)
    valid_indices = indices[0]
    valid_distances = distances[0]
    valid_mask = valid_indices >= 0
    result_ids = item_ids[valid_indices[valid_mask]].tolist()
    result_scores = valid_distances[valid_mask].tolist()

    return SearchResponse(
        itemIds=[int(x) for x in result_ids],
        scores=[float(x) for x in result_scores],
    )


@app.post("/rank", response_model=RankResponse)
def rank(req: RankRequest):
    """
    Phase 4 — Wide & Deep ranking.

    Ranker 가 없거나 candidate metadata 누락 시 identity (입력 순서 그대로 + score 0) 반환.
    호출자가 이 경우 retrieval score 를 그대로 사용.
    """
    if not req.candidate_item_ids:
        return RankResponse(itemIds=[], scores=[])
    if req.k <= 0 or req.k > 1000:
        raise HTTPException(status_code=400, detail="k must be in [1, 1000]")

    with state.lock:
        session = state.ranker_session
        meta = state.item_meta_lookup

    if session is None or not meta:
        # Ranker 미배치 — fallback: 입력 순서 유지, score 0
        ids = req.candidate_item_ids[: req.k]
        return RankResponse(itemIds=ids, scores=[0.0] * len(ids))

    # Metadata 가 없는 candidate 는 제외 (cold-start item)
    filtered = [(iid, meta[iid]) for iid in req.candidate_item_ids if iid in meta]
    if not filtered:
        return RankResponse(itemIds=[], scores=[])

    item_ids_arr = np.array([x[0] for x in filtered], dtype=np.int64)
    item_city_arr = np.array([x[1][0] for x in filtered], dtype=np.int64)
    item_cat_arr = np.array([x[1][1] for x in filtered], dtype=np.int64)
    user_id_arr = np.full_like(item_ids_arr, req.user_id, dtype=np.int64)
    user_city_arr = np.full_like(item_ids_arr, req.user_city, dtype=np.int64)

    try:
        scores = session.run(
            ["score"],
            {
                "user_id": user_id_arr,
                "item_id": item_ids_arr,
                "user_city": user_city_arr,
                "item_city": item_city_arr,
                "item_category": item_cat_arr,
            },
        )[0].astype("float32")
    except Exception as e:
        log.warning(f"ONNX ranking inference failed: {e}")
        ids = req.candidate_item_ids[: req.k]
        return RankResponse(itemIds=ids, scores=[0.0] * len(ids))

    # Sort by score desc, take top-K
    order = np.argsort(-scores)
    top_order = order[: req.k]
    top_ids = item_ids_arr[top_order].tolist()
    top_scores = scores[top_order].tolist()
    return RankResponse(
        itemIds=[int(x) for x in top_ids],
        scores=[float(x) for x in top_scores],
    )


@app.post("/reindex")
def reindex():
    """모델 재로드 (retrieval + ranking) + 인덱스 재빌드 atomic swap."""
    try:
        state.load()
        return {
            "status": "ok",
            "retrieval_ready": state.retrieval_ready(),
            "ranking_ready": state.ranking_ready(),
            "n_items": int(state.item_embeddings.shape[0]) if state.retrieval_ready() else 0,
            "n_ranker_meta": len(state.item_meta_lookup),
        }
    except Exception as e:
        log.error(f"Reindex failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
