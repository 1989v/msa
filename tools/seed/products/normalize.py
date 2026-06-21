#!/usr/bin/env python3
"""ADR-0056 Part 1 — 오픈데이터 → 상품 시드(JSONL) 정규화기.

상품명(식약처)·가격(한국소비자원 참가격)·카테고리를 합쳐 search:batch 의 ProductSeedIngestTasklet 이
읽는 products.jsonl 을 생성한다.

소스 & 라이선스:
  - 식약처 식품(첨가물)품목제조보고 #15064909 (식품안전나라 svc I1250) — 이용허락범위 제한없음.
      품목명(PRDLST_NM)/제조사(BSSH_NM)/식품유형(PRDLST_DCNM). 가격·이미지 없음.
  - 한국소비자원 참가격 #3043385 (openapi.price.go.kr ProductPriceInfoService) — KOGL 제1유형.
      getProductInfoSvc(상품 마스터: goodId/goodName/소분류) + getProductPriceInfoSvc(실판매가 goodPrice).
  원천 raw 응답은 레포에 커밋하지 않는다. 정규화된 JSONL 만 적재에 사용.

--source:
  sample            동봉 샘플(24종). 키 불필요.
  chamgagyeok       참가격 단독 — 100% 실판매가 생필품 카탈로그.
  join (기본, 키 필요) 식약처 품목명(볼륨) + 참가격 실가격 fuzzy join. 미매칭은 합성가(또는 --no-synthetic 시 제외).
  mfds              식약처만 — 가격 전량 카테고리 기반 합성가.

사용:
  export DATA_GO_KR_KEY='...(Encoding 서비스키)...'
  python3 normalize.py --source chamgagyeok --out products.jsonl          # 실가격만
  python3 normalize.py --source join --no-synthetic --out products.jsonl  # 식약처∩참가격 실가격만
  python3 normalize.py --from-sample --out products.jsonl                 # 키 없이 샘플

참가격 응답은 XML(평문 HTTP)이며 컨테이너 태그에 점이 포함된다(iros.openapi.service.vo.*).
일부 파이썬 빌드에 expat 모듈이 없어 ElementTree 파싱이 실패하므로, 의존성 없는 정규식 파서로 구현.

출력 한 줄 스키마: {"name","price","stock","brand","description","category"}  (price>0, Money 불변식)
"""
from __future__ import annotations

import argparse
import datetime
import difflib
import hashlib
import html
import json
import os
import re
import statistics
import sys
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

HERE = Path(__file__).resolve().parent
SAMPLE = HERE / "products.sample.jsonl"

# 식약처 식품(첨가물)품목제조보고 (JSON): /{KEY}/I1250/json/{start}/{end}
MFDS_ENDPOINT = "http://openapi.foodsafetykorea.go.kr/api"
# 한국소비자원 참가격 (XML, plaintext HTTP). serviceKey 는 인코딩키를 그대로 붙인다(이중 인코딩 금지).
PRICE_ENDPOINT = "http://openapi.price.go.kr/openApiImpl/ProductPriceInfoService"

# 식품유형(PRDLST_DCNM) → 카테고리 대략 매핑. 없으면 "식품>기타".
CATEGORY_HINTS = {
    "면": "식품>면류", "라면": "식품>면류",
    "우유": "식품>유제품", "발효유": "식품>유제품", "치즈": "식품>유제품",
    "음료": "음료>기타", "탄산": "음료>탄산", "커피": "음료>커피", "차": "음료>차",
    "과자": "식품>과자", "캔디": "식품>과자", "초콜릿": "식품>과자",
    "조미": "식품>조미료", "장": "식품>조미료", "기름": "식품>조미료",
    "통조림": "식품>통조림", "즉석": "식품>즉석식품", "김치": "식품>김치", "두부": "식품>두부",
}

# 참가격 매칭 실패 시에만 쓰는 카테고리 기반 합성가(KRW) 밴드.
SYNTHETIC_PRICE_BAND = {
    "식품>면류": (3000, 6000), "식품>유제품": (2500, 6000), "음료>탄산": (1500, 3000),
    "음료>커피": (5000, 15000), "식품>과자": (1500, 4000), "식품>조미료": (5000, 12000),
    "식품>통조림": (4000, 9000), "식품>즉석식품": (5000, 9000), "식품>김치": (10000, 25000),
    "식품>두부": (2000, 4000), "식품>기타": (2000, 8000),
}


# ---------- 공통 유틸 ----------
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


def _norm(name: str) -> str:
    """매칭 키 — 소문자화 + 괄호(용량) 제거 + 영숫자/한글만."""
    s = (name or "").lower()
    s = re.sub(r"\(.*?\)", "", s)
    s = re.sub(r"[^0-9a-z가-힣]", "", s)
    return s


def _http_json(url: str) -> dict:
    with urlopen(url, timeout=60) as resp:  # noqa: S310 (trusted gov endpoint)
        return json.load(resp)


def _http_text(url: str) -> str:
    with urlopen(url, timeout=120) as resp:  # noqa: S310
        return resp.read().decode("utf-8", errors="replace")


def _price_url(op: str, key: str, params: dict) -> str:
    qs = urlencode(params)
    sep = "&" if qs else ""
    # serviceKey(Encoding) 는 추가 인코딩 없이 원형 그대로 부착.
    return f"{PRICE_ENDPOINT}/{op}?serviceKey={key}{sep}{qs}"


def _blocks(xml_text: str, container_suffix: str) -> list[str]:
    """반복 컨테이너 블록 추출 (점 포함 태그 지원). 의존성 없는 정규식 파서."""
    pat = re.compile(
        rf"<([A-Za-z0-9_.]*{re.escape(container_suffix)})\b[^>]*>(.*?)</\1>",
        re.DOTALL,
    )
    return [m.group(2) for m in pat.finditer(xml_text)]


def _field(block: str, tag: str) -> str | None:
    m = re.search(rf"<{re.escape(tag)}\b[^>]*>(.*?)</{re.escape(tag)}>", block, re.DOTALL)
    if not m:
        return None
    return html.unescape(m.group(1)).strip() or None


def _recent_fridays(n: int = 10) -> list[str]:
    today = datetime.date.today()
    offset = (today.weekday() - 4) % 7  # 금요일=4
    last_fri = today - datetime.timedelta(days=offset)
    return [(last_fri - datetime.timedelta(weeks=i)).strftime("%Y%m%d") for i in range(n)]


# ---------- 식약처 ----------
def fetch_mfds(key: str, limit: int) -> list[dict]:
    """식약처 품목제조보고에서 (name, brand, category) 레코드 수집."""
    rows: list[dict] = []
    page, page_size = 1, 1000
    while len(rows) < limit:
        start = (page - 1) * page_size + 1
        end = min(start + page_size - 1, limit)
        data = _http_json(f"{MFDS_ENDPOINT}/{key}/I1250/json/{start}/{end}")
        items = (data.get("I1250", {}).get("row", [])) or []
        if not items:
            break
        for it in items:
            name = (it.get("PRDLST_NM") or "").strip()
            if not name:
                continue
            rows.append({
                "name": name,
                "brand": (it.get("BSSH_NM") or "").strip() or None,
                "category": _category_of(it.get("PRDLST_DCNM")),
                "description": (it.get("PRDLST_DCNM") or "").strip() or None,
            })
        page += 1
    return rows[:limit]


# ---------- 참가격 ----------
def fetch_price_table(key: str, inspect_day: str | None) -> tuple[str | None, dict[str, int]]:
    """getProductPriceInfoSvc → {goodId: 대표가격(중앙값)}. 조사일은 금요일만 유효 → fallback 시도."""
    days = [inspect_day] if inspect_day else _recent_fridays()
    for day in days:
        try:
            text = _http_text(_price_url("getProductPriceInfoSvc.do", key, {"goodInspectDay": day}))
        except Exception as e:  # noqa: BLE001
            print(f"  가격 조회 실패(day={day}): {e}", file=sys.stderr)
            continue
        by_good: dict[str, list[int]] = {}
        for block in _blocks(text, "goodPriceVO"):
            gid = _field(block, "goodId")
            raw = _field(block, "goodPrice") or _field(block, "goodSellPrice")
            if not gid or not (raw and raw.isdigit()):
                continue
            price = int(raw)
            if price > 0:
                by_good.setdefault(gid, []).append(price)
        if by_good:
            table = {gid: int(statistics.median(p)) for gid, p in by_good.items()}
            print(f"  참가격 조사일 {day}: {len(table)}개 상품 실가격 수집", file=sys.stderr)
            return day, table
    return None, {}


def fetch_product_master(key: str) -> list[dict]:
    """getProductInfoSvc → 상품 마스터 [{goodId, goodName, smlclsCode}]."""
    try:
        text = _http_text(_price_url("getProductInfoSvc.do", key, {}))
    except Exception as e:  # noqa: BLE001
        print(f"  상품 마스터 조회 실패: {e}", file=sys.stderr)
        return []
    out: list[dict] = []
    for block in _blocks(text, "item"):
        gid = _field(block, "goodId")
        name = _field(block, "goodName")
        if gid and name:
            out.append({"goodId": gid, "goodName": name, "smlclsCode": _field(block, "goodSmlclsCode") or ""})
    return out


def fetch_category_names(key: str) -> dict[str, str]:
    """getStandardInfoSvc classCode=AL → {소분류코드: 명}. best-effort."""
    try:
        text = _http_text(_price_url("getStandardInfoSvc.do", key, {"classCode": "AL"}))
    except Exception:  # noqa: BLE001
        return {}
    out: dict[str, str] = {}
    for block in _blocks(text, "stdInfoVO"):
        code = _field(block, "code")
        cname = _field(block, "codeName")
        if code and cname:
            out[code] = cname
    return out


def build_chamgagyeok(key: str, inspect_day: str | None) -> tuple[list[dict], dict[str, int]]:
    """참가격 단독 레코드(실가격) + {정규화상품명: 가격} 조인 룩업 동시 생성."""
    day, price_by_good = fetch_price_table(key, inspect_day)
    master = fetch_product_master(key)
    cat_names = fetch_category_names(key)

    records: list[dict] = []
    name_price: dict[str, int] = {}
    for m in master:
        price = price_by_good.get(m["goodId"])
        if not price or price <= 0:
            continue
        name = m["goodName"]
        category = cat_names.get(m["smlclsCode"]) or "생필품"
        records.append({
            "name": name, "price": price, "stock": 100, "brand": None,
            "description": category, "category": category,
        })
        name_price[_norm(name)] = price
    print(f"  참가격 실가격 레코드 {len(records)}건 (조사일 {day})", file=sys.stderr)
    return records, name_price


def price_for_name(name: str, lookup: dict[str, int], norm_keys: list[str]) -> int | None:
    """식약처 상품명 → 참가격 실가격 fuzzy 매칭."""
    key = _norm(name)
    if not key:
        return None
    if key in lookup:
        return lookup[key]
    for nk, pr in lookup.items():
        if len(nk) >= 3 and (nk in key or key in nk):
            return pr
    m = difflib.get_close_matches(key, norm_keys, n=1, cutoff=0.85)
    return lookup[m[0]] if m else None


# ---------- 출력 ----------
def _emit(out: Path, rows: list[dict]) -> int:
    n = 0
    with out.open("w", encoding="utf-8") as dst:
        for r in rows:
            if not r.get("name") or int(r.get("price", 0)) <= 0:
                continue
            brand = r.get("brand")
            desc = r.get("description")
            dst.write(json.dumps({
                "name": str(r["name"])[:200],
                "price": int(r["price"]),
                "stock": int(r.get("stock", 100)),
                "brand": str(brand)[:100] if brand else None,
                "description": str(desc)[:2000] if desc else None,
                "category": str(r.get("category") or "")[:100] or None,
            }, ensure_ascii=False) + "\n")
            n += 1
    return n


def normalize_from_sample(out: Path) -> int:
    rows = []
    with SAMPLE.open(encoding="utf-8") as src:
        for raw in src:
            line = raw.strip()
            if line and not line.startswith("#"):
                rows.append(json.loads(line))
    return _emit(out, rows)


def main() -> int:
    ap = argparse.ArgumentParser(description="오픈데이터 → 상품 시드 JSONL 정규화기")
    ap.add_argument("--out", default="products.jsonl")
    ap.add_argument("--source", choices=["sample", "chamgagyeok", "join", "mfds"], default="join")
    ap.add_argument("--limit", type=int, default=2000, help="식약처 수집 최대 상품 수")
    ap.add_argument("--inspect-day", help="참가격 조사일 YYYYMMDD(금요일). 미지정 시 최근 금요일 자동 탐색")
    ap.add_argument("--from-sample", action="store_true", help="--source sample 과 동일")
    ap.add_argument("--no-synthetic", action="store_true", help="참가격 미매칭(실가격 없음) 행을 합성가 대신 제외")
    args = ap.parse_args()
    out = Path(args.out)

    source = "sample" if args.from_sample else args.source

    if source == "sample":
        n = normalize_from_sample(out)
        print(f"[sample] {n} products → {out}", file=sys.stderr)
        return 0

    key = os.environ.get("DATA_GO_KR_KEY")
    if not key:
        print("DATA_GO_KR_KEY 미설정 → 샘플로 폴백", file=sys.stderr)
        n = normalize_from_sample(out)
        print(f"[sample] {n} products → {out}", file=sys.stderr)
        return 0

    if source == "chamgagyeok":
        records, _ = build_chamgagyeok(key, args.inspect_day)
        n = _emit(out, records)
        print(f"[chamgagyeok] {n} products (전량 실가격) → {out}", file=sys.stderr)
        return 0

    if source == "mfds":
        rows = [
            {**r, "price": _synthetic_price(r["name"], r["category"]), "stock": 100}
            for r in fetch_mfds(key, args.limit)
        ]
        n = _emit(out, rows)
        print(f"[mfds] {n} products (가격=합성) → {out}", file=sys.stderr)
        return 0

    # source == "join": 식약처 볼륨 + 참가격 실가격 조인
    cham_records, name_price = build_chamgagyeok(key, args.inspect_day)
    norm_keys = list(name_price.keys())
    rows = list(cham_records)  # 참가격 실가격 레코드는 그대로 포함
    seen = {_norm(r["name"]) for r in cham_records}

    matched = synth = dropped = 0
    for r in fetch_mfds(key, args.limit):
        nk = _norm(r["name"])
        if nk in seen:
            continue  # 참가격에서 이미 실가격으로 포함됨
        real = price_for_name(r["name"], name_price, norm_keys)
        if real:
            matched += 1
            rows.append({**r, "price": real, "stock": 100})
        elif args.no_synthetic:
            dropped += 1
        else:
            synth += 1
            rows.append({**r, "price": _synthetic_price(r["name"], r["category"]), "stock": 100})

    n = _emit(out, rows)
    print(
        f"[join] {n} products → {out} "
        f"(참가격 실가격 {len(cham_records)} + 식약처 매칭 {matched}, 합성 {synth}, 제외 {dropped})",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
