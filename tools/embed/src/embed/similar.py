"""비슷한 곳 — 같은 언어·같은 유형·**다른 시도**에서 코사인 상위 5 (자기 제외).

place 에 이미 있는 문서 벡터(`attraction_embedding`)를 읽어 계산하고, 결과를 place `attraction_similar` 로 올린다.
재색인(search-batch)이 그 표를 읽어 상세의 「비슷한 곳」 섹션에 싣는다. 모델을 부르지 않으므로 GPU 가 필요 없다.

  tools/embed/tunnel.sh place
  python -m embed.similar run --model-ref 'microsoft/harrier-oss-v1-270m@31de22b#d640' --internal http://localhost:8096 --dry-run
  python -m embed.similar run --model-ref 'microsoft/harrier-oss-v1-270m@31de22b#d640' --internal http://localhost:8096

`--model-ref` 는 search 의 `SEARCH_EMBEDDING_MODEL_REF` 와 **같은 문자열**이어야 한다. 재색인은 설정의 스탬프로
목록을 조회하므로, 다른 스탬프로 올린 목록은 읽히지 않는다.

같은 시도를 빼는 이유: 같은 시도의 비슷한 곳은 「같은 분류 가까운 곳」과 「주변 명소」가 이미 보여 준다.
이 섹션은 여행지를 옮겨 갈 후보를 보여 주는 자리다.
"""
from __future__ import annotations

import argparse
import re
import sys
import time
from dataclasses import dataclass

import numpy as np

from . import client, vectors

#: 문서당 목록 길이. 서버 `AttractionSimilarInternalController.MAX_SIMILAR` 와 같은 값.
TOP_K = 5
#: 한 번에 곱하는 질의 행 수. 가장 큰 묶음(국문 관광지 약 1.5만 건)에서도 1024×1.5만×4B ≈ 60MB 에 머문다.
DEFAULT_BLOCK = 1024
#: place 목록 API 의 size 상한(`AttractionController` 가 1~200 으로 자른다).
LIST_PAGE_SIZE = 200

_MODEL_REF = re.compile(r"^(.+)@([A-Za-z0-9]{7})#d(\d+)$")


@dataclass(frozen=True)
class Doc:
    id: int
    lang: str
    content_type_id: str | None
    sido: str | None
    title: str


@dataclass(frozen=True)
class Similar:
    id: int
    score: float


def top_k_elsewhere(docs: list[Doc], matrix: np.ndarray, *, k: int = TOP_K,
                    block: int = DEFAULT_BLOCK) -> dict[int, list[Similar]]:
    """`matrix[i]` 는 `docs[i]` 의 L2 정규화 벡터. 반환은 문서 id → 점수 내림차순 목록.

    시도나 유형을 모르는 문서는 「다른 시도·같은 유형」을 판정할 수 없어 질의에서도 후보에서도 빠진다(키가 없다).
    같은 시도 마스킹이 자기 자신도 가린다 — 자기 제외를 따로 두지 않는다.
    """
    if len(docs) != matrix.shape[0]:
        raise ValueError(f"문서 수와 벡터 수가 다르다: {len(docs)} != {matrix.shape[0]}")
    groups: dict[tuple[str, str], list[int]] = {}
    for row, doc in enumerate(docs):
        if doc.sido and doc.content_type_id:
            groups.setdefault((doc.lang, doc.content_type_id), []).append(row)

    out: dict[int, list[Similar]] = {}
    for rows in groups.values():
        index = np.asarray(rows)
        group = np.ascontiguousarray(matrix[index], dtype=np.float32)
        _, sido = np.unique([docs[r].sido for r in rows], return_inverse=True)
        take = min(k, len(rows))
        for start in range(0, len(rows), block):
            end = min(start + block, len(rows))
            scores = group[start:end] @ group.T
            scores[sido[start:end, None] == sido[None, :]] = -np.inf
            if take < len(rows):
                top = np.argpartition(-scores, take - 1, axis=1)[:, :take]
            else:
                top = np.broadcast_to(np.arange(len(rows)), (end - start, len(rows)))
            for offset in range(end - start):
                cand = top[offset]
                cand = cand[np.argsort(-scores[offset, cand], kind="stable")]
                out[docs[rows[start + offset]].id] = [
                    Similar(docs[rows[c]].id, float(scores[offset, c])) for c in cand if np.isfinite(scores[offset, c])
                ]
    return out


def bulk_items(docs: list[Doc], lists: dict[int, list[Similar]]) -> list[dict]:
    """문서마다 한 항목. 후보가 없으면 빈 목록을 보낸다 — 서버가 그 문서의 옛 목록을 지운다."""
    return [
        {"attractionId": d.id, "similar": [{"id": s.id, "score": s.score} for s in lists.get(d.id, [])]}
        for d in docs
    ]


class PlaceSimilarClient(client.InternalClient):
    """`/internal/attractions/similar` — 관광지 유사 목록."""

    PATH = "/internal/attractions/similar"

    def bulk(self, model_ref: str, items: list[dict]) -> dict:
        if not items:
            return {"documents": 0, "rows": 0}
        if len(items) > client.MAX_BATCH:
            raise ValueError(f"한 번에 {client.MAX_BATCH}건까지입니다: {len(items)}")
        return self.request("PUT", f"{self.PATH}/bulk", body={"modelRef": model_ref, "items": items})


def load_docs(api: client.InternalClient) -> list[Doc]:
    """place 목록 API 를 id 키셋으로 끝까지 — ACTIVE 만, 계산에 쓰는 네 필드만 남긴다."""
    out: list[Doc] = []
    after = 0
    while True:
        data = api.request("GET", "/api/places/attractions", params={"afterId": after, "size": LIST_PAGE_SIZE})
        for a in data.get("attractions", []):
            if a.get("status", "ACTIVE") != "ACTIVE":
                continue
            out.append(Doc(int(a["id"]), a["lang"], a.get("contentTypeId") or None, a.get("ldongRegnCd") or None,
                           a.get("titleDisplay") or a["title"]))
        nxt = data.get("nextAfterId")
        if nxt is None:
            return out
        after = int(nxt)


def load_vectors(api: client.PlaceEmbeddingClient, model_ref: str, ids: list[int]) -> dict[int, np.ndarray]:
    dim = dim_of(model_ref)
    out: dict[int, np.ndarray] = {}
    for start in range(0, len(ids), client.MAX_BATCH):
        for it in api.lookup(model_ref, ids[start:start + client.MAX_BATCH]).get("items", []):
            out[int(it["attractionId"])] = vectors.decode(it["vector"], dim)
    return out


def dim_of(model_ref: str) -> int:
    m = _MODEL_REF.match(model_ref)
    if not m:
        raise ValueError(f"model_ref 형식이 아니다(hf_id@rev7#d{{dim}}): {model_ref}")
    return int(m.group(3))


def run(model_ref: str, internal_url: str, *, k: int, block: int, dry_run: bool) -> int:
    dim_of(model_ref)
    t0 = time.monotonic()
    places = client.InternalClient(internal_url)
    docs = load_docs(places)
    t1 = time.monotonic()
    print(f"문서 {len(docs)}건 (ACTIVE) — {t1 - t0:.1f}s")

    embeddings = load_vectors(client.PlaceEmbeddingClient(internal_url), model_ref, [d.id for d in docs])
    t2 = time.monotonic()
    with_vector = [d for d in docs if d.id in embeddings]
    print(f"벡터 {len(with_vector)}/{len(docs)}건 ({model_ref}) — {t2 - t1:.1f}s")
    if not with_vector:
        print("  ! 이 스탬프의 벡터가 하나도 없다 — --model-ref 가 search 설정과 같은지 본다", file=sys.stderr)
        return 1

    matrix = np.stack([embeddings[d.id] for d in with_vector])
    lists = top_k_elsewhere(with_vector, matrix, k=k, block=block)
    t3 = time.monotonic()
    filled = sum(1 for v in lists.values() if v)
    print(f"계산: 목록 {filled}건 · 빈 목록 {len(docs) - filled}건 — {t3 - t2:.1f}s")

    title = {d.id: d.title for d in docs}
    for d in with_vector[:3]:
        shown = ", ".join(f"{title[s.id]}({s.score:.3f})" for s in lists.get(d.id, []))
        print(f"  예: {d.title} → {shown or '(없음)'}")

    if dry_run:
        print("  (dry-run — 보내지 않는다)")
        return 0

    api = PlaceSimilarClient(internal_url)
    items = bulk_items(docs, lists)
    rows = 0
    for start in range(0, len(items), client.MAX_BATCH):
        rows += int(api.bulk(model_ref, items[start:start + client.MAX_BATCH]).get("rows", 0))
    t4 = time.monotonic()
    print(f"적재: 문서 {len(items)}건 · 행 {rows} — {t4 - t3:.1f}s\n합계 {t4 - t0:.1f}s")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m embed.similar", description="비슷한 곳(다른 시도) 계산·적재")
    sub = p.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run")
    r.add_argument("--model-ref", required=True, help="search 의 SEARCH_EMBEDDING_MODEL_REF 와 같은 값")
    r.add_argument("--internal", required=True, help="place port-forward 주소 (예: http://localhost:8096)")
    r.add_argument("--k", type=int, default=TOP_K)
    r.add_argument("--block", type=int, default=DEFAULT_BLOCK)
    r.add_argument("--dry-run", action="store_true", help="계산만 하고 보내지 않는다")
    a = p.parse_args(argv)
    return run(a.model_ref, a.internal, k=min(a.k, TOP_K), block=a.block, dry_run=a.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
