"""
ADR-0046 — Recommendation ANN sidecar (Python FastAPI + FAISS HNSW + ONNX Runtime).

학습 자료: study/docs/20-recommendation-modeling/24-msa-two-tower-ann.md

흐름:
1. 시작 시 ONNX user_tower + item_embeddings.npy 로드 → FAISS HNSW 색인 빌드
2. POST /search → user_id 로 user_tower forward → FAISS Top-K → response
3. POST /reindex → 모델/임베딩 재로드 + 인덱스 재빌드 (atomic swap)

학습 산출물 (recommendation-ml/train_two_tower.py 가 만드는 것):
- /models/user_tower.onnx
- /models/item_embeddings.npy
- /models/item_ids.npy

FAISS HNSW 파라미터 (학습 §10 §3-2):
- M = 16 (노드당 연결 수)
- ef_construction = 200 (빌드 시 후보 너비)
- ef_search = 100 (런타임 검색 너비)
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
    """In-memory model + index. Atomic swap on reindex."""

    def __init__(self):
        self.user_session: ort.InferenceSession | None = None
        self.item_embeddings: np.ndarray | None = None
        self.item_ids: np.ndarray | None = None
        self.index: faiss.Index | None = None
        self.lock = threading.RLock()

    def load(self):
        log.info(f"Loading models from {MODELS_DIR}...")
        user_onnx = MODELS_DIR / "user_tower.onnx"
        item_emb = MODELS_DIR / "item_embeddings.npy"
        item_ids = MODELS_DIR / "item_ids.npy"

        if not user_onnx.exists() or not item_emb.exists() or not item_ids.exists():
            log.warning(
                f"Models not found in {MODELS_DIR} — service will start in degraded mode"
            )
            return

        new_session = ort.InferenceSession(str(user_onnx), providers=["CPUExecutionProvider"])
        new_embeddings = np.load(item_emb).astype("float32")
        new_ids = np.load(item_ids)

        dim = new_embeddings.shape[1]
        new_index = faiss.IndexHNSWFlat(dim, HNSW_M, faiss.METRIC_INNER_PRODUCT)
        new_index.hnsw.efConstruction = HNSW_EF_CONSTRUCTION
        new_index.add(new_embeddings)
        new_index.hnsw.efSearch = HNSW_EF_SEARCH

        with self.lock:
            self.user_session = new_session
            self.item_embeddings = new_embeddings
            self.item_ids = new_ids
            self.index = new_index

        log.info(
            f"Loaded: items={new_embeddings.shape[0]} dim={dim} "
            f"hnsw(M={HNSW_M}, efC={HNSW_EF_CONSTRUCTION}, efS={HNSW_EF_SEARCH})"
        )

    def is_ready(self) -> bool:
        return self.user_session is not None and self.index is not None


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


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok" if state.is_ready() else "degraded",
        "ready": state.is_ready(),
        "n_items": int(state.item_embeddings.shape[0]) if state.is_ready() else 0,
    }


@app.get("/actuator/health/liveness")
def liveness():
    return {"status": "ok"}


@app.get("/actuator/health/readiness")
def readiness():
    return {"status": "ok" if state.is_ready() else "degraded"}


@app.post("/search", response_model=SearchResponse)
def search(req: SearchRequest):
    if not state.is_ready():
        # Empty 결과 — Kotlin 측 use case 가 cold-start fallback
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
        log.warning(f"ONNX inference failed: {e}")
        return SearchResponse(itemIds=[], scores=[])

    distances, indices = index.search(user_emb.astype("float32"), req.k)

    valid_indices = indices[0]
    valid_distances = distances[0]
    # FAISS 가 결과 부족 시 -1 채움
    valid_mask = valid_indices >= 0
    result_ids = item_ids[valid_indices[valid_mask]].tolist()
    result_scores = valid_distances[valid_mask].tolist()

    return SearchResponse(
        itemIds=[int(x) for x in result_ids],
        scores=[float(x) for x in result_scores],
    )


@app.post("/reindex")
def reindex():
    """모델 재로드 + FAISS 인덱스 재빌드 (atomic swap)."""
    try:
        state.load()
        return {"status": "ok", "n_items": int(state.item_embeddings.shape[0])}
    except Exception as e:
        log.error(f"Reindex failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
