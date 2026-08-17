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


def pick(rows: list[dict], lang: str | None, budget: int) -> list[dict]:
    """개요가 빈 것만, 이미지 보유분 우선."""
    missing = [r for r in rows
               if not (r.get("overview") or "").strip()
               and (lang is None or r.get("lang") == lang)]
    missing.sort(key=lambda r: (0 if (r.get("imageUrl") or "").strip() else 1, r["contentId"]))
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
        print(f"[{lg}] 전체 {len(sub):,} · 개요없음 {len(miss):,} (이미지보유 {with_img:,})",
              file=sys.stderr)
    if args.stats_only:
        return 0

    key = os.environ.get("TOUR_API_KEY") or os.environ.get("DATA_GO_KR_KEY")
    if not key:
        raise SystemExit("TOUR_API_KEY 가 필요합니다")

    targets = pick(rows, args.lang, args.budget)
    if not targets:
        print("채울 대상이 없습니다", file=sys.stderr)
        return 0

    filled = 0
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
                print(f"  {row['contentId']} 스킵: {e}", file=sys.stderr)
                overview = ""
            if not overview:
                continue
            rec = {k: row.get(k) for k in UPSERT_FIELDS if row.get(k) is not None}
            rec["overview"] = overview
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
            filled += 1
            if i % 100 == 0:
                print(f"  {i}/{len(targets)} (채움 {filled})", file=sys.stderr)
            time.sleep(0.15)

    print(f"[overview] {filled}/{len(targets)}건 → {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
