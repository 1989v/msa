"""문서 벡터 하루 루틴 — pending → 텍스트 조합 → 해시 비교 → (touch | 임베딩) → bulk (ADR-0090).

서버는 벡터를 만들지 않는다. 여기가 pending 을 받아 공개 API 로 원문을 가져오고, 임베딩 텍스트 규칙
(`embed_text.attraction_text`)으로 조립해 해시를 낸다. 저장된 해시와 같으면 **모델을 돌리지 않고 touch** 한다
— `attractions.updated_at` 은 전화·이미지만 바뀌어도 올라가므로 pending 의 대부분이 실제로는 그대로다.

  python -m embed.docs run    --model qwen3-4b --internal http://localhost:8096 --device mps
  python -m embed.docs run    --model qwen3-4b --internal http://localhost:8096 --dry-run
  python -m embed.docs status --model qwen3-4b --internal http://localhost:8096
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

from . import bakeoff, client, models, vectors
from .embed_text import attraction_text, text_hash

#: pending 이 이만큼 넘으면 id 별 조회 대신 풀스캔이 싸다(첫 채움). 5만 건을 하나씩 부르면 5만 요청이다.
FULL_SCAN_THRESHOLD = 2000


@dataclass
class Plan:
    """한 배치를 어떻게 처리할지. 모델을 로드하기 **전에** 정해진다 — touch 만 있는 날은 모델이 필요 없다."""

    touch: list[dict] = field(default_factory=list)          # vector 없이 보내는 항목
    embed: list[tuple[int, str]] = field(default_factory=list)  # (attraction_id, embedding_text)
    missing_docs: list[int] = field(default_factory=list)     # 공개 API 에 없던 id (비활성/삭제)

    def summary(self) -> str:
        s = f"touch {len(self.touch)} · 임베딩 {len(self.embed)}"
        if self.missing_docs:
            s += f" · 원문 없음 {len(self.missing_docs)}"
        return s


def plan_batch(model_ref: str, ids: list[int], docs: dict[int, dict], stored_hashes: dict[int, str]) -> Plan:
    """순수 함수 — 네트워크 없이 판정한다. 텍스트 규칙과 해시 규약이 여기서 한 번만 적용된다."""
    plan = Plan()
    for attraction_id in ids:
        doc = docs.get(attraction_id)
        if doc is None:
            plan.missing_docs.append(attraction_id)
            continue
        text = attraction_text(
            title=doc.get("titleDisplay") or doc["title"],
            title_local=doc.get("titleLocal"),
            category=doc.get("category"),
            address=doc.get("address"),
            overview=doc.get("overview"),
            lang=doc.get("lang", "ko"),
        )
        digest = text_hash(model_ref, text)
        if stored_hashes.get(attraction_id) == digest:
            plan.touch.append({"attractionId": attraction_id, "embeddingText": text, "textHash": digest})
        else:
            plan.embed.append((attraction_id, text))
    return plan


def fetch_by_ids(public_url: str, ids: list[int], *, sleep: float = 0.02) -> dict[int, dict]:
    """`GET /api/places/attractions/{id}` 하나씩. pending 이 적은 평소에 쓴다."""
    out: dict[int, dict] = {}
    for attraction_id in ids:
        try:
            doc = bakeoff._get_json(f"{public_url.rstrip('/')}/api/places/attractions/{attraction_id}", {})["data"]
        except RuntimeError as e:
            print(f"  ! {attraction_id}: 원문을 못 받았다 — {e}", file=sys.stderr)
            continue
        if doc:
            out[int(doc["id"])] = doc
        time.sleep(sleep)
    return out


def fetch_full(public_url: str, *, cache_path: str | None, langs: tuple[str, ...] = ("ko", "en")) -> dict[int, dict]:
    """풀스캔 + 캐시. 첫 채움처럼 pending 이 코퍼스 전체일 때 쓴다."""
    cache = Path(cache_path) if cache_path else None
    if cache and cache.exists():
        raw = json.loads(cache.read_text(encoding="utf-8"))
    else:
        raw = []
        for lang in langs:
            raw.extend(bakeoff.fetch_attractions(public_url, lang=lang))
        if cache:
            cache.parent.mkdir(parents=True, exist_ok=True)
            cache.write_text(json.dumps(raw, ensure_ascii=False), encoding="utf-8")
    return {int(a["id"]): a for a in raw}


class _LazyModel:
    """모델은 **처음 임베딩이 필요할 때** 로드한다. touch 만 있는 날 2GB 를 읽지 않기 위해서."""

    def __init__(self, spec, device: str | None):
        self.spec, self.device, self._model = spec, device, None

    def encode(self, texts: list[str]):
        if self._model is None:
            print(f"  · 모델 로드: {self.spec.hf_id} (device={self.device or 'auto'})")
            self._model = bakeoff.load_model(self.spec, device=self.device)
        # bakeoff.encode 가 정규화 → MRL 자르기 → 재정규화까지 한다. 여기서 또 정규화하지 않는다.
        return bakeoff.encode(self._model, texts, prompt=self.spec.doc_prompt, dim=self.spec.dim)


def run(model_key: str, internal_url: str, *, public_url: str, dim: int | None, device: str | None,
        batch: int, dry_run: bool, corpus_cache: str | None, max_batches: int | None) -> int:
    spec = models.resolve_revision(models.CANDIDATES[model_key])
    if dim:
        spec = spec.with_dim(dim)
    ref = spec.ref
    api = client.PlaceEmbeddingClient(internal_url)

    head = api.pending(ref, limit=1)
    total_pending = int(head["missing"]) + int(head["stale"])
    print(f"모델 {ref}\n대기: 없음 {head['missing']} + 낡음 {head['stale']} = {total_pending}")
    if total_pending == 0:
        _print_status(api.status(ref))
        return 0

    if total_pending >= FULL_SCAN_THRESHOLD:
        print(f"  · pending 이 {FULL_SCAN_THRESHOLD} 이상이라 풀스캔으로 원문을 받는다")
        corpus = fetch_full(public_url, cache_path=corpus_cache)
        print(f"  · 원문 {len(corpus)}건")
    else:
        corpus = None

    model = _LazyModel(spec, device)
    applied = {"inserted": 0, "updated": 0, "touched": 0}
    seen_batches, previous_ids = 0, None
    while True:
        pending = api.pending(ref, limit=batch)
        ids = [int(i) for i in pending["ids"]]
        if not ids:
            break
        if ids == previous_ids:
            print(f"  ! 같은 배치가 다시 왔다({len(ids)}건) — 서버가 반영하지 않았거나 원문이 없다. 멈춘다", file=sys.stderr)
            return 1
        previous_ids = ids

        docs = {i: corpus[i] for i in ids if i in corpus} if corpus is not None else fetch_by_ids(public_url, ids)
        stored = {int(it["attractionId"]): it["textHash"] for it in api.lookup(ref, ids).get("items", [])}
        plan = plan_batch(ref, ids, docs, stored)
        print(f"  배치 {seen_batches + 1}: {len(ids)}건 → {plan.summary()}")
        if plan.missing_docs:
            print(f"    ! 원문 없음: {plan.missing_docs[:10]}{' …' if len(plan.missing_docs) > 10 else ''}", file=sys.stderr)

        if dry_run:
            print("    (dry-run — 한 배치만 판정하고 보내지 않는다)")
            return 0

        items = list(plan.touch)
        if plan.embed:
            vecs = model.encode([t for _, t in plan.embed])
            for (attraction_id, text), vec in zip(plan.embed, vecs):
                vectors.check_normalized(vec, label=f"attraction {attraction_id}")
                items.append({"attractionId": attraction_id, "embeddingText": text,
                              "textHash": text_hash(ref, text), "vector": vectors.encode(vec)})
        if not items:
            print("    ! 보낼 것이 없는데 pending 은 남아 있다 — 원문을 못 받는 id 뿐이다. 멈춘다", file=sys.stderr)
            return 1

        result = api.bulk(ref, spec.dim, items)
        for k in applied:
            applied[k] += int(result.get(k, 0))
        print(f"    → 새로 {result.get('inserted', 0)} · 갱신 {result.get('updated', 0)} · touch {result.get('touched', 0)}")

        seen_batches += 1
        if max_batches and seen_batches >= max_batches:
            print(f"  · --max-batches {max_batches} 에 도달해 멈춘다")
            break

    print(f"\n합계: 새로 {applied['inserted']} · 갱신 {applied['updated']} · touch {applied['touched']}")
    _print_status(api.status(ref))
    return 0


def _print_status(status: dict) -> None:
    print(f"상태: 전체 {status.get('total')} · 임베딩됨 {status.get('embedded')} · 없음 {status.get('missing')} "
          f"· 낡음 {status.get('stale')} · 마지막 {status.get('lastEmbeddedAt')}")


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="python -m embed.docs", description="관광지 문서 벡터 동기화")
    sub = p.add_subparsers(dest="cmd", required=True)
    for name in ("run", "status"):
        s = sub.add_parser(name)
        s.add_argument("--model", required=True, choices=sorted(models.CANDIDATES))
        s.add_argument("--dim", type=int)
        s.add_argument("--internal", required=True, help="port-forward 주소 (예: http://localhost:8096)")
    run_p = sub.choices["run"]
    run_p.add_argument("--public", default="https://api.1989v.com", help="원문을 받는 공개 API")
    run_p.add_argument("--device", help="mps | cuda | cpu")
    run_p.add_argument("--batch", type=int, default=client.MAX_BATCH)
    run_p.add_argument("--dry-run", action="store_true", help="한 배치만 판정하고 보내지 않는다")
    run_p.add_argument("--corpus-cache", help="풀스캔 결과를 둘 파일")
    run_p.add_argument("--max-batches", type=int, help="이만큼만 처리하고 멈춘다")
    a = p.parse_args(argv)

    if a.cmd == "status":
        spec = models.resolve_revision(models.CANDIDATES[a.model])
        if a.dim:
            spec = spec.with_dim(a.dim)
        _print_status(client.PlaceEmbeddingClient(a.internal).status(spec.ref))
        return 0
    return run(a.model, a.internal, public_url=a.public, dim=a.dim, device=a.device, batch=min(a.batch, client.MAX_BATCH),
               dry_run=a.dry_run, corpus_cache=a.corpus_cache, max_batches=a.max_batches)


if __name__ == "__main__":
    raise SystemExit(main())
