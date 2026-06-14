#!/usr/bin/env python3
"""ADR-0056 Part 1 — 오픈데이터 → 상품 시드(JSONL) 정규화기.

식약처 식품(첨가물)품목제조보고(data.go.kr #15064909, 식품안전나라 svc I1250)에서
상품명/제조사/식품유형을 받아오고, (선택) 한국소비자원 참가격(#3043385)에서 가격을 조인하여
search:batch 의 ProductSeedIngestTasklet 이 읽는 products.jsonl 을 생성한다.

라이선스:
  - 식약처 #15064909: 이용허락범위 제한없음 (상업/재배포 OK)
  - 한국소비자원 참가격 #3043385: KOGL 제1유형 (출처표시)
  원천 raw 응답은 레포에 커밋하지 않는다. 정규화된 products.jsonl 만 적재에 사용.

사용:
  export DATA_GO_KR_KEY='...'                 # data.go.kr 디코딩 서비스키
  python3 normalize.py --out products.jsonl --limit 2000
  # 키가 없으면 동봉된 products.sample.jsonl 을 검증/통과시켜 즉시 사용 가능:
  python3 normalize.py --from-sample --out products.jsonl

출력 한 줄 스키마: {"name","price","stock","brand","description","category"}
가격(Money)은 0보다 커야 하므로 price<=0 행은 제외된다.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import hashlib
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

HERE = Path(__file__).resolve().parent
SAMPLE = HERE / "products.sample.jsonl"

# 식약처 식품(첨가물)품목제조보고 (JSON). 서비스 상세는 README 참조.
MFDS_ENDPOINT = "http://openapi.foodsafetykorea.go.kr/api"  # /{KEY}/I1250/json/{start}/{end}

# 식품유형(PRDLST_DCNM) → 카테고리 대략 매핑. 없으면 "식품>기타".
CATEGORY_HINTS = {
    "면": "식품>면류", "라면": "식품>면류",
    "우유": "식품>유제품", "발효유": "식품>유제품", "치즈": "식품>유제품",
    "음료": "음료>기타", "탄산": "음료>탄산", "커피": "음료>커피", "차": "음료>차",
    "과자": "식품>과자", "캔디": "식품>과자", "초콜릿": "식품>과자",
    "조미": "식품>조미료", "장": "식품>조미료", "기름": "식품>조미료",
    "통조림": "식품>통조림", "즉석": "식품>즉석식품", "김치": "식품>김치", "두부": "식품>두부",
}

# 참가격 가격이 없을 때 카테고리 기반 합성가(KRW). 결정적 jitter 로 상품마다 다르게.
SYNTHETIC_PRICE_BAND = {
    "식품>면류": (3000, 6000), "식품>유제품": (2500, 6000), "음료>탄산": (1500, 3000),
    "음료>커피": (5000, 15000), "식품>과자": (1500, 4000), "식품>조미료": (5000, 12000),
    "식품>통조림": (4000, 9000), "식품>즉석식품": (5000, 9000), "식품>김치": (10000, 25000),
    "식품>두부": (2000, 4000), "식품>기타": (2000, 8000),
}


def _category_of(food_type: str | None) -> str:
    t = (food_type or "").strip()
    for key, cat in CATEGORY_HINTS.items():
        if key in t:
            return cat
    return "식품>기타"


def _synthetic_price(name: str, category: str) -> int:
    lo, hi = SYNTHETIC_PRICE_BAND.get(category, (2000, 8000))
    h = int(hashlib.sha256(name.encode("utf-8")).hexdigest(), 16)
    span = max(1, (hi - lo) // 100)
    return lo + (h % span) * 100


def _http_json(url: str) -> dict:
    with urlopen(url, timeout=30) as resp:  # noqa: S310 (trusted gov endpoint)
        return json.load(resp)


def fetch_mfds(key: str, limit: int) -> list[dict]:
    """식약처 품목제조보고에서 (name, brand, category) 레코드를 수집."""
    rows: list[dict] = []
    page, page_size = 1, 1000
    while len(rows) < limit:
        start = (page - 1) * page_size + 1
        end = min(start + page_size - 1, limit)
        url = f"{MFDS_ENDPOINT}/{key}/I1250/json/{start}/{end}"
        data = _http_json(url)
        block = data.get("I1250", {})
        items = block.get("row", []) or []
        if not items:
            break
        for it in items:
            name = (it.get("PRDLST_NM") or "").strip()
            if not name:
                continue
            category = _category_of(it.get("PRDLST_DCNM"))
            rows.append({
                "name": name,
                "brand": (it.get("BSSH_NM") or "").strip() or None,
                "category": category,
                "description": (it.get("PRDLST_DCNM") or "").strip() or None,
            })
        page += 1
    return rows[:limit]


def normalize_from_sample(out: Path) -> int:
    """키 없이: 샘플을 검증 후 그대로 출력 (price<=0 / name 공백 제외)."""
    count = 0
    with SAMPLE.open(encoding="utf-8") as src, out.open("w", encoding="utf-8") as dst:
        for raw in src:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            rec = json.loads(line)
            if not rec.get("name") or float(rec.get("price", 0)) <= 0:
                continue
            dst.write(json.dumps(rec, ensure_ascii=False) + "\n")
            count += 1
    return count


def main() -> int:
    ap = argparse.ArgumentParser(description="오픈데이터 → 상품 시드 JSONL 정규화기")
    ap.add_argument("--out", default="products.jsonl", help="출력 JSONL 경로")
    ap.add_argument("--limit", type=int, default=2000, help="최대 상품 수")
    ap.add_argument("--from-sample", action="store_true", help="API 호출 없이 샘플로 생성")
    ap.add_argument("--no-synthetic", action="store_true",
                    help="가격 없음(참가격 미연동) 행을 합성가 대신 제외")
    args = ap.parse_args()
    out = Path(args.out)

    if args.from_sample:
        n = normalize_from_sample(out)
        print(f"[from-sample] {n} products → {out}", file=sys.stderr)
        return 0

    key = os.environ.get("DATA_GO_KR_KEY")
    if not key:
        print("DATA_GO_KR_KEY 미설정 → --from-sample 로 폴백합니다.", file=sys.stderr)
        n = normalize_from_sample(out)
        print(f"[from-sample] {n} products → {out}", file=sys.stderr)
        return 0

    rows = fetch_mfds(key, args.limit)
    # TODO(참가격 #3043385): 상품명 정규화 후 fuzzy join 으로 실제 KRW 가격 보강.
    #   현재는 미연동 시 카테고리 기반 합성가를 부여(--no-synthetic 로 제외 가능).
    written = 0
    with out.open("w", encoding="utf-8") as dst:
        for r in rows:
            price = _synthetic_price(r["name"], r["category"])
            if args.no_synthetic:
                continue  # 참가격 join 구현 전까지 합성가 비활성 시 스킵
            if price <= 0:
                continue
            dst.write(json.dumps({
                "name": r["name"][:200],
                "price": price,
                "stock": 100,
                "brand": (r["brand"] or "")[:100] or None,
                "description": (r["description"] or "")[:2000] or None,
                "category": r["category"][:100],
            }, ensure_ascii=False) + "\n")
            written += 1
    print(f"[mfds] {written} products → {out} (price=synthetic, 참가격 join TODO)", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
