"""첫 채움 — Colab 이 낸 parquet 을 내부 API 로 밀어 넣는다 (ADR-0090 §5).

노트북은 클러스터에 닿지 않는다(자격증명을 Colab 에 두지 않는다). 노트북은 parquet 만 내고,
터널을 여는 것도 미는 것도 로컬의 이 명령이다.

parquet 컬럼: `attraction_id, model_ref, dim, embedding_text, text_hash, vector`
(`bakeoff.export_vectors` 가 내는 모양).

보내기 전에 **도구가 먼저 검사한다** — 업서트는 요청 단위 all-or-nothing 이라 500건 중 한 건이 틀리면
나머지 499건도 거부된다. 어느 행이 왜 틀렸는지는 서버 400 보다 여기서 보는 편이 빠르다.

  python -m embed.push --file vectors.parquet --internal http://localhost:8096 --dry-run
  python -m embed.push --file vectors.parquet --internal http://localhost:8096 --skip 12
"""
from __future__ import annotations

import argparse
import sys

import numpy as np

from . import client, vectors
from .embed_text import text_hash


def validate(df) -> tuple[str, int]:
    """단일 스탬프·차원인지, 해시와 벡터가 서로 맞는지. 반환은 (model_ref, dim)."""
    required = {"attraction_id", "model_ref", "dim", "embedding_text", "text_hash", "vector"}
    missing = required - set(df.columns)
    if missing:
        raise ValueError(f"parquet 에 없는 컬럼: {sorted(missing)}")
    if df.empty:
        raise ValueError("parquet 이 비어 있다")

    refs = sorted(set(df["model_ref"]))
    if len(refs) != 1:
        raise ValueError(f"한 파일에는 한 스탬프만 담는다: {refs}")
    dims = sorted({int(d) for d in df["dim"]})
    if len(dims) != 1:
        raise ValueError(f"한 파일에는 한 차원만 담는다: {dims}")
    ref, dim = refs[0], dims[0]

    dupes = df["attraction_id"].duplicated()
    if bool(dupes.any()):
        raise ValueError(f"attraction_id 가 겹친다: {sorted(df.loc[dupes, 'attraction_id'].unique())[:10]}")

    for row in df.itertuples(index=False):
        where = f"attraction_id {row.attraction_id}"
        expected = text_hash(ref, row.embedding_text)
        if row.text_hash != expected:
            raise ValueError(f"{where}: text_hash 가 임베딩 텍스트와 맞지 않는다 "
                             f"(임베딩 텍스트 규칙이 바뀐 parquet 이면 다시 만들어야 한다)")
        vec = np.asarray(row.vector, dtype=np.float32)
        if vec.size != dim:
            raise ValueError(f"{where}: 벡터 길이 {vec.size} != dim {dim}")
        vectors.check_normalized(vec, label=where)
    return ref, dim


def push(path: str, internal_url: str, *, batch: int, skip: int, dry_run: bool) -> int:
    import pandas as pd

    df = pd.read_parquet(path)
    ref, dim = validate(df)
    total = len(df)
    batches = (total + batch - 1) // batch
    print(f"{path}\n스탬프 {ref} · 차원 {dim} · {total}행 · {batches}배치 (검사 통과)")
    if skip:
        print(f"  · 앞 {skip}배치는 건너뛴다 (이미 보낸 것으로 본다)")
    if dry_run:
        print("  (dry-run — 보내지 않는다)")
        return 0

    api = client.PlaceEmbeddingClient(internal_url)
    applied = {"inserted": 0, "updated": 0, "touched": 0}
    for index in range(skip, batches):
        chunk = df.iloc[index * batch:(index + 1) * batch]
        items = [{"attractionId": int(r.attraction_id), "embeddingText": r.embedding_text,
                  "textHash": r.text_hash, "vector": vectors.encode(np.asarray(r.vector, dtype=np.float32))}
                 for r in chunk.itertuples(index=False)]
        try:
            result = api.bulk(ref, dim, items)
        except client.InternalApiError as e:
            print(f"\n배치 {index} 에서 멈췄다 — 고친 뒤 `--skip {index}` 로 이어서 보내면 된다\n{e}", file=sys.stderr)
            return 1
        for k in applied:
            applied[k] += int(result.get(k, 0))
        print(f"  배치 {index + 1}/{batches} → 새로 {result.get('inserted', 0)} · 갱신 {result.get('updated', 0)}")

    print(f"\n합계: 새로 {applied['inserted']} · 갱신 {applied['updated']} · touch {applied['touched']}")
    st = api.status(ref)
    print(f"상태: 전체 {st.get('total')} · 임베딩됨 {st.get('embedded')} · 없음 {st.get('missing')} · 낡음 {st.get('stale')}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m embed.push", description="parquet 벡터를 내부 API 로 업서트")
    p.add_argument("--file", required=True, help="bakeoff.export_vectors 가 낸 parquet")
    p.add_argument("--internal", required=True, help="port-forward 주소 (예: http://localhost:8096)")
    p.add_argument("--batch", type=int, default=client.MAX_BATCH)
    p.add_argument("--skip", type=int, default=0, help="앞 N배치 건너뛰기 (끊긴 뒤 이어서)")
    p.add_argument("--dry-run", action="store_true", help="검사만 하고 보내지 않는다")
    a = p.parse_args(argv)
    return push(a.file, a.internal, batch=min(a.batch, client.MAX_BATCH), skip=a.skip, dry_run=a.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
