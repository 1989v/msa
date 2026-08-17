#!/usr/bin/env python3
"""개요(overview) 점진 수집 — detailCommon2 는 **건당 1콜**이라 일일 한도가 병목이다.

목록 조회(areaBasedList2)는 100건/콜이라 전량이 하루면 끝나지만, 개요는 레코드마다
한 번씩 불러야 해서 수만 건이면 며칠이 걸린다. 그래서 한 번에 다 받지 않고
**우선순위 + 일일 예산**으로 나눠 채운다.

우선순위: 이미지가 있는 것 → 화면에 실제로 노출되는 카드부터 채워야 체감이 빨리 온다.

place SSOT 에서 개요가 빈 레코드를 읽어 채운 뒤 jsonl 로 떨군다. 적재는 pipeline.sh
(bulk upsert)가 맡는다 — **부분 전송은 다른 필드를 지우므로 전체 레코드를 되돌려 보낸다.**

Usage:
  TOUR_API_KEY=... python3 backfill_overview.py --budget 1000 --out /tmp/overview.jsonl
  TOUR_API_KEY=... python3 backfill_overview.py --lang en --budget 500
  python3 backfill_overview.py --stats-only          # 남은 양만 확인 (API 호출 없음)
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from sync_tour import SERVICES, tour_get  # noqa: E402

PLACE_API = os.environ.get("PLACE_API", "https://1989v.com")
PAGE_SIZE = 1000

# 원천에 개요가 아예 없는 레코드의 negative cache.
# 대상 선정은 "SSOT 에 개요가 비었는가"로만 판단하는데, 원천이 빈 값을 주는 레코드는
# 채울 방법이 없으면서 영원히 "비어 있음"으로 남는다. 정렬이 결정적이라 매 실행마다
# 큐 앞자리를 다시 차지하고, 하루치 예산을 갉아먹는 양이 날마다 늘어난다.
# DB 에는 "개요 없음 확인함"을 표현할 자리가 없으므로 로컬 상태로 둔다.
EMPTY_CACHE = Path(os.environ.get(
    "TOUR_EMPTY_CACHE",
    Path.home() / ".local/state/1989v/tour-overview-empty.txt"))


def load_empty_cache() -> set[str]:
    if not EMPTY_CACHE.exists():
        return set()
    return {l.strip() for l in EMPTY_CACHE.read_text().splitlines() if l.strip()}

# bulk upsert 가 받는 필드 (id·status 는 서버 소유라 되돌려 보내지 않는다)
UPSERT_FIELDS = ("contentId", "lang", "title", "latitude", "longitude", "address",
                 "areaCode", "sigunguCode", "category", "imageUrl", "tel",
                 "overview", "sourceModifiedAt")


def fetch_all() -> list[dict]:
    rows, page = [], 0
    while True:
        qs = urllib.parse.urlencode({"page": page, "size": PAGE_SIZE})
        # 엣지가 기본 urllib UA 를 403 으로 막는다 — 브라우저와 같은 헤더를 준다
        req = urllib.request.Request(
            f"{PLACE_API}/api/places/attractions?{qs}",
            headers={"Accept": "application/json",
                     "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                                   "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"})
        with urllib.request.urlopen(req, timeout=60) as r:
            data = json.loads(r.read().decode())["data"]
        got = data.get("attractions") or []
        rows.extend(got)
        if len(rows) >= int(data.get("totalElements") or 0) or not got:
            break
        page += 1
    return rows


# 관광 성격의 분류 — 음식/쇼핑/숙박보다 먼저 채운다.
# 건수로는 음식·쇼핑이 절반을 넘어서, 이미지 유무로만 정렬하면 첫 배치가 통째로
# 음식점으로 채워진다. 사이트가 보여주려는 건 관광지다.
SIGHT_CATEGORIES = ("nature", "history", "culture", "leisure")


def pick(rows: list[dict], lang: str | None, budget: int, known_empty: set[str]) -> list[dict]:
    """개요가 빈 것만 — 관광지 우선, 그 안에서 이미지 보유분 우선."""
    missing = [r for r in rows
               if not (r.get("overview") or "").strip()
               and (lang is None or r.get("lang") == lang)
               and f"{r.get('lang')}:{r['contentId']}" not in known_empty]
    missing.sort(key=lambda r: (
        0 if r.get("category") in SIGHT_CATEGORIES else 1,
        0 if (r.get("imageUrl") or "").strip() else 1,
        r["contentId"],
    ))
    return missing[:budget]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lang", choices=["ko", "en"], help="미지정 시 ko 우선 후 en")
    ap.add_argument("--budget", type=int, default=1000, help="detailCommon2 호출 상한 (일일 1000)")
    ap.add_argument("--out", default="/tmp/overview.jsonl")
    ap.add_argument("--stats-only", action="store_true")
    args = ap.parse_args()

    rows = fetch_all()
    for lg in ("ko", "en"):
        sub = [r for r in rows if r.get("lang") == lg]
        miss = [r for r in sub if not (r.get("overview") or "").strip()]
        with_img = sum(1 for r in miss if (r.get("imageUrl") or "").strip())
        sight = sum(1 for r in miss if r.get("category") in SIGHT_CATEGORIES)
        print(f"[{lg}] 전체 {len(sub):,} · 개요없음 {len(miss):,} "
              f"(관광지 {sight:,} · 이미지보유 {with_img:,})", file=sys.stderr)
    if args.stats_only:
        return 0

    key = os.environ.get("TOUR_API_KEY") or os.environ.get("DATA_GO_KR_KEY")
    if not key:
        raise SystemExit("TOUR_API_KEY 가 필요합니다")

    known_empty = load_empty_cache()
    targets = pick(rows, args.lang, args.budget, known_empty)
    if not targets:
        print("채울 대상이 없습니다", file=sys.stderr)
        return 0

    filled = 0
    newly_empty: list[str] = []
    out = Path(args.out)
    with out.open("w", encoding="utf-8") as f:
        for i, row in enumerate(targets, 1):
            svc_key = "kor" if row["lang"] == "ko" else "eng"
            service, _ = SERVICES[svc_key]
            try:
                body = tour_get(key, service, "detailCommon2", {"contentId": row["contentId"]})
                item = (body.get("items") or {}).get("item")
                if isinstance(item, list):
                    item = item[0] if item else None
                overview = ((item or {}).get("overview") or "").strip()
            except Exception as e:
                # 일시적 실패(429/네트워크)는 negative cache 에 넣지 않는다 —
                # 넣으면 그 레코드는 영영 다시 시도되지 않는다.
                print(f"  {row['contentId']} 스킵: {e}", file=sys.stderr)
                overview = None
            if not overview:
                if overview == "":   # 원천이 빈 값을 준 것 — 다시 불러도 결과가 같다
                    newly_empty.append(f"{row['lang']}:{row['contentId']}")
                continue
            rec = {k: row.get(k) for k in UPSERT_FIELDS if row.get(k) is not None}
            rec["overview"] = overview
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            filled += 1
            if i % 100 == 0:
                print(f"  {i}/{len(targets)} (채움 {filled})", file=sys.stderr)
            time.sleep(0.15)

    if newly_empty:
        EMPTY_CACHE.parent.mkdir(parents=True, exist_ok=True)
        with EMPTY_CACHE.open("a", encoding="utf-8") as f:
            f.write("\n".join(newly_empty) + "\n")

    print(f"[overview] {filled}/{len(targets)}건 → {out}"
          f"{f' · 원천 개요없음 {len(newly_empty)}건 기록' if newly_empty else ''}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
