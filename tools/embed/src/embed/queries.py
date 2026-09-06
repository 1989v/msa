"""질의 사전 — 시드 적재와 미적중 되먹임 (ADR-0090 · embedding-entities.md §3).

질의는 서버에서 임베딩하지 않는다. 미리 만들어 둔 사전에 없으면 벡터 레그를 끄고 BM25 로만 답한다.
사전을 채우는 길이 둘이다:

- **시드**(`seed`) — `intents.yml` 의 의도 문구. 첫날부터 뜻으로 묻는 질의가 덮인다.
- **미적중**(`misses`) — 운영에서 사전에 없던 질의를 카운트 내림차순으로 받아 임베딩하고, 넣은 것만 지운다.
  카운트가 곧 우선순위라, 많이 물어본 것부터 사전이 된다.

정규화는 **서버가 한다.** 도구는 원문을 보낸다 — 정규화 규칙이 두 곳에 있으면 `_id` 가 어긋나
사전이 통째로 미적중이 된다.

  python -m embed.queries seed   --model arctic-ko --internal http://localhost:8083 --intents docs/specs/2026-09-05-unified-search/intents.yml
  python -m embed.queries misses --model arctic-ko --internal http://localhost:8083 --device mps
  python -m embed.queries status --model arctic-ko --internal http://localhost:8083
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml

from . import bakeoff, client, models, vectors


def load_intents(path: str) -> list[tuple[str, str]]:
    """`intents.yml` → [(질의, 언어)]. 언어는 기록용이고 서버 계약에는 없다 — 사전 항목은 언어를 가리지 않는다."""
    raw = yaml.safe_load(Path(path).read_text(encoding="utf-8")) or {}
    out: list[tuple[str, str]] = []
    seen: set[str] = set()
    for lang in ("ko", "en"):
        for q in raw.get(lang) or []:
            q = str(q).strip()
            if q and q not in seen:
                seen.add(q)
                out.append((q, lang))
    return out


def embed_queries(spec, queries: list[str], *, device: str | None, batch_size: int = 64):
    """질의는 **`query_prompt`** 를 붙여 인코딩한다 — 문서와 다른 프롬프트를 쓰는 모델이 대부분이다."""
    model = bakeoff.load_model(spec, device=device)
    return bakeoff.encode(model, queries, prompt=spec.query_prompt, dim=spec.dim, batch_size=batch_size)


def _push(api: client.QueryVectorClient, spec, pairs: list[tuple[str, str]], *, device: str | None,
          dry_run: bool, batch: int) -> tuple[int, int]:
    """pairs = [(질의, source)]. 반환은 (보낸 수, 서버가 건너뛴 수)."""
    if not pairs:
        return 0, 0
    if dry_run:
        for q, src in pairs[:20]:
            print(f"  {src:<6} {q}")
        print(f"  … 모두 {len(pairs)}건 (dry-run — 모델도 돌리지 않는다)")
        return 0, 0
    vecs = embed_queries(spec, [q for q, _ in pairs], device=device)
    upserted = skipped = 0
    for start in range(0, len(pairs), batch):
        chunk = pairs[start:start + batch]
        items = []
        for (q, src), vec in zip(chunk, vecs[start:start + batch]):
            vectors.check_normalized(vec, label=f"query {q!r}")
            items.append({"query": q, "vector": vectors.encode(vec), "source": src})
        result = api.bulk(spec.ref, spec.dim, items)
        upserted += int(result.get("upserted", 0))
        skipped += int(result.get("skippedEmpty", 0))
        print(f"  {start + len(chunk)}/{len(pairs)} → 적재 {result.get('upserted', 0)} · 건너뜀 {result.get('skippedEmpty', 0)}")
    return upserted, skipped


def seed(model_key: str, internal_url: str, *, intents_path: str, dim: int | None, device: str | None,
         dry_run: bool, batch: int) -> int:
    spec = models.resolve_revision(models.CANDIDATES[model_key])
    if dim:
        spec = spec.with_dim(dim)
    pairs = [(q, "INTENT") for q, _ in load_intents(intents_path)]
    print(f"모델 {spec.ref}\n시드 {len(pairs)}건 ({intents_path})")
    upserted, skipped = _push(client.QueryVectorClient(internal_url), spec, pairs,
                              device=device, dry_run=dry_run, batch=batch)
    if not dry_run:
        print(f"\n적재 {upserted} · 정규화 후 빈 질의 {skipped}")
    return 0


def misses(model_key: str, internal_url: str, *, dim: int | None, device: str | None, limit: int,
           dry_run: bool, batch: int) -> int:
    """미적중 질의를 사전에 넣는다. **넣은 것만** 지운다 — 실패한 것은 카운트를 남겨 다음에 다시 온다."""
    spec = models.resolve_revision(models.CANDIDATES[model_key])
    if dim:
        spec = spec.with_dim(dim)
    api = client.QueryVectorClient(internal_url)
    rows = api.misses(spec.ref, limit=limit)
    if not rows:
        print("미적중 질의가 없다")
        return 0
    print(f"모델 {spec.ref}\n미적중 {len(rows)}건 (상위: " +
          ", ".join(f"{r['normalized']}×{r['count']}" for r in rows[:5]) + ")")

    # 서버가 준 것은 **정규화된** 문자열이다. 그것을 그대로 원문으로 보낸다 —
    # 정규화는 멱등이라 다시 정규화해도 같은 `_id` 가 나온다.
    pairs = [(r["normalized"], "LOG") for r in rows]
    upserted, skipped = _push(api, spec, pairs, device=device, dry_run=dry_run, batch=batch)
    if dry_run:
        return 0
    removed = api.clear_misses(spec.ref, [r["normalized"] for r in rows]).get("removed", 0)
    print(f"\n적재 {upserted} · 건너뜀 {skipped} · 미적중 목록에서 {removed}건 제거")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m embed.queries", description="질의 사전 적재")
    sub = p.add_subparsers(dest="cmd", required=True)
    for name in ("seed", "misses", "status"):
        s = sub.add_parser(name)
        s.add_argument("--model", required=True, choices=sorted(models.CANDIDATES))
        s.add_argument("--dim", type=int)
        s.add_argument("--internal", required=True, help="port-forward 주소 (예: http://localhost:8083)")
        if name != "status":
            s.add_argument("--device", help="mps | cuda | cpu")
            s.add_argument("--dry-run", action="store_true")
            s.add_argument("--batch", type=int, default=client.MAX_BATCH)
    sub.choices["seed"].add_argument("--intents", required=True, help="intents.yml 경로")
    sub.choices["misses"].add_argument("--limit", type=int, default=client.MAX_BATCH)
    a = p.parse_args(argv)

    spec = models.resolve_revision(models.CANDIDATES[a.model])
    if a.dim:
        spec = spec.with_dim(a.dim)
    if a.cmd == "status":
        st = client.QueryVectorClient(a.internal).status(spec.ref)
        print(f"사전: 항목 {st.get('entries')} · 대기 중인 미적중 {st.get('pendingMisses')}")
        return 0
    batch = min(a.batch, client.MAX_BATCH)
    if a.cmd == "seed":
        return seed(a.model, a.internal, intents_path=a.intents, dim=a.dim, device=a.device,
                    dry_run=a.dry_run, batch=batch)
    return misses(a.model, a.internal, dim=a.dim, device=a.device, limit=a.limit, dry_run=a.dry_run, batch=batch)


if __name__ == "__main__":
    raise SystemExit(main())
