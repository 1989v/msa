#!/usr/bin/env python3
"""ADR-0056/0059 — 오픈데이터 → 상품 시드(JSONL) 정규화기.

상품명(식약처)·가격(한국소비자원 참가격)·카테고리에 더해, 영양성분(식약처 영양 표준데이터)·
원재료(식약처 C002)를 품목제조보고번호로 조인하여 search:batch 의 ProductSeedIngestTasklet 이
읽는 products.jsonl 을 생성한다.

소스 & 라이선스:
  - 식약처 식품(첨가물)품목제조보고 #15064909 (식품안전나라 svc I1250) — 이용허락범위 제한없음.
      품목명(PRDLST_NM)/제조사(BSSH_NM)/식품유형(PRDLST_DCNM)/품목제조번호(PRDLST_REPORT_NO).
  - 한국소비자원 참가격 #3043385 (openapi.price.go.kr ProductPriceInfoService) — KOGL 제1유형.
      getProductInfoSvc(상품 마스터) + getProductPriceInfoSvc(실판매가).
  - 식약처 전국통합식품영양성분정보(가공식품) 표준데이터 #15100066 — 제한없음. 100g 기준
      에너지(kcal)/탄수화물/단백질/지방/당류/나트륨 + 원산지국명/수입여부 + 품목제조보고번호(조인키).
      · CSV 모드(--nutrition-csv): 포털에서 내려받은 CSV 를 한글 헤더로 파싱 — 확정 스펙, 권장.
      · API 모드(기본): 표준데이터 OpenAPI(tn_pubr...) — 영문 필드명이 문서화되지 않아
        후보키 매칭으로 동작. 매칭 0건이면 --dump-keys 로 실제 키를 출력해 진단한다.
  - 식약처 식품(첨가물)품목제조보고(원재료) #15062098 (svc C002) — 제한없음.
      PRDLST_REPORT_NO 필터 → RAWMTRL_NM/RAWMTRL_ORDNO. --ingredients 로 opt-in (건당 1콜).
  원천 raw 응답은 레포에 커밋하지 않는다. 정규화된 JSONL 만 적재에 사용.

키: DATA_GO_KR_KEY(참가격·영양 표준 API, data.go.kr Encoding 키).
    MFDS_KEY(식품안전나라 I1250/C002 인증키) — 미설정 시 DATA_GO_KR_KEY 재사용.

--source:
  sample            동봉 샘플(24종, 영양 포함). 키 불필요.
  chamgagyeok       참가격 단독 — 100% 실판매가 생필품 카탈로그 (품목보고번호 없음 → 영양 미조인).
  join (기본)        식약처 품목명(볼륨) + 참가격 실가격 fuzzy join + 영양/원재료 조인.
  mfds              식약처만 — 가격 전량 카테고리 기반 합성가 + 영양/원재료 조인.

사용:
  export DATA_GO_KR_KEY='...(Encoding 서비스키)...'
  python3 normalize.py --source join --no-synthetic --out products.jsonl
  python3 normalize.py --source join --nutrition-csv 통합식품영양성분정보.csv --ingredients
  python3 normalize.py --dump-keys                    # 영양 API 실제 필드명 진단
  python3 normalize.py --from-sample --out products.jsonl

출력 한 줄 스키마(모두 nullable 은 생략 가능):
  {"name","price","stock","brand","description","category",
   "itemReportNo","energyKcal","carbohydrateG","proteinG","fatG","sugarG","sodiumMg",
   "ingredients","originCountry"}   (price>0 — Money 불변식, 영양은 100g 기준)
"""
from __future__ import annotations

import argparse
import csv
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
# 전국통합식품영양성분정보(가공식품) 표준데이터 OpenAPI (#15100066)
NUTRI_ENDPOINT = "https://api.data.go.kr/openapi/tn_pubr_public_nutri_process_info_api"

# 표준데이터 API 의 영문 필드명은 공식 문서에 미기재 → 후보키 매칭 (실패 시 --dump-keys 진단).
NUTRI_KEYS = {
    "report": ["itemReportNo", "itemReprtNo", "item_report_no", "ITEM_REPORT_NO"],
    "kcal": ["enerc", "ENERC", "energyKcal", "energy"],
    "carb": ["chocdf", "CHOCDF", "carbohydrate"],
    "prot": ["prot", "PROT", "protein"],
    "fat": ["fatce", "FATCE", "fat"],
    "sugar": ["sugar", "SUGAR"],
    "sodium": ["nat", "NAT", "sodium"],
    "basis": ["nutConSrtrQua", "nutConSrtrQty", "servSize", "foodSize"],
    "origin": ["cooNm", "cooCntyNm", "originNm", "orgplcNm"],
}

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

NUTRITION_FIELDS = ("energyKcal", "carbohydrateG", "proteinG", "fatG", "sugarG", "sodiumMg")


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


def _pick(item: dict, keys: list[str]):
    for k in keys:
        v = item.get(k)
        if v not in (None, "", "N/A"):
            return v
    return None


def _to_float(v) -> float | None:
    try:
        f = float(str(v).replace(",", "").strip())
    except (TypeError, ValueError):
        return None
    return f if f >= 0 else None


def _to_int_or(v, default: int) -> int:
    try:
        return int(str(v).strip())
    except (TypeError, ValueError):
        return default


# ---------- 식약처 (품목제조보고 I1250) ----------
def fetch_mfds(key: str, limit: int) -> list[dict]:
    """식약처 품목제조보고에서 (name, brand, category, itemReportNo) 레코드 수집."""
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
                "itemReportNo": (it.get("PRDLST_REPORT_NO") or "").strip() or None,
            })
        page += 1
    return rows[:limit]


# ---------- 식약처 (원재료 C002) ----------
def fetch_ingredients(mfds_key: str, report_nos: list[str], cap: int) -> dict[str, str]:
    """C002 를 품목제조번호별로 조회해 {reportNo: '원재료1, 원재료2, ...'} 생성.

    건당 1 API 콜 (개발키 일 1만건 한도) — cap 으로 상한. 표시순서(RAWMTRL_ORDNO) 정렬.
    """
    out: dict[str, str] = {}
    targets = report_nos[:cap]
    for i, rep in enumerate(targets, 1):
        try:
            data = _http_json(f"{MFDS_ENDPOINT}/{mfds_key}/C002/json/1/100/PRDLST_REPORT_NO={rep}")
        except Exception as e:  # noqa: BLE001
            print(f"  C002 조회 실패({rep}): {e}", file=sys.stderr)
            continue
        items = (data.get("C002", {}).get("row", [])) or []
        mats = sorted(
            (_to_int_or(it.get("RAWMTRL_ORDNO"), 9999), (it.get("RAWMTRL_NM") or "").strip())
            for it in items
            if (it.get("RAWMTRL_NM") or "").strip()
        )
        seen: set[str] = set()
        names = [nm for _, nm in mats if not (nm in seen or seen.add(nm))]
        if names:
            out[rep] = ", ".join(names)[:2000]
        if i % 100 == 0:
            print(f"  C002 원재료 {i}/{len(targets)}건 조회", file=sys.stderr)
    print(f"  C002 원재료 매핑 {len(out)}건 (대상 {len(targets)}건)", file=sys.stderr)
    return out


# ---------- 식약처 (영양 표준데이터 #15100066) ----------
def _nutri_info(basis, kcal, carb, prot, fat, sugar, sodium, origin) -> dict | None:
    """기준량 100g/100mL 행만 채택 (칼로리 계산기 = 값/100 × 섭취량 g 전제)."""
    if basis and "100" not in str(basis):
        return None
    info = {
        "energyKcal": _to_float(kcal),
        "carbohydrateG": _to_float(carb),
        "proteinG": _to_float(prot),
        "fatG": _to_float(fat),
        "sugarG": _to_float(sugar),
        "sodiumMg": _to_float(sodium),
        "originCountry": (str(origin).strip()[:64] or None) if origin else None,
    }
    return info if any(info[f] is not None for f in NUTRITION_FIELDS) else None


def fetch_nutrition_api(key: str, limit: int, dump_keys: bool = False) -> dict[str, dict]:
    """표준데이터 OpenAPI 에서 {품목제조보고번호: 영양 dict} 수집. 후보키 매칭."""
    out: dict[str, dict] = {}
    skipped_basis = 0
    page, page_size = 1, 1000
    while (page - 1) * page_size < limit:
        url = f"{NUTRI_ENDPOINT}?serviceKey={key}&pageNo={page}&numOfRows={page_size}&type=json"
        try:
            data = _http_json(url)
        except Exception as e:  # noqa: BLE001
            print(f"  영양 API 조회 실패(page={page}): {e}", file=sys.stderr)
            break
        body = (data.get("response", {}) or {}).get("body", {}) or {}
        items = body.get("items") or []
        if isinstance(items, dict):
            items = items.get("item") or []
        if not items:
            break
        if dump_keys:
            print("[dump-keys] 영양 API 첫 행의 실제 필드명:", file=sys.stderr)
            print("  " + ", ".join(sorted(items[0].keys())), file=sys.stderr)
            return {}
        for it in items:
            rep = _pick(it, NUTRI_KEYS["report"])
            if not rep:
                continue
            info = _nutri_info(
                _pick(it, NUTRI_KEYS["basis"]),
                _pick(it, NUTRI_KEYS["kcal"]),
                _pick(it, NUTRI_KEYS["carb"]),
                _pick(it, NUTRI_KEYS["prot"]),
                _pick(it, NUTRI_KEYS["fat"]),
                _pick(it, NUTRI_KEYS["sugar"]),
                _pick(it, NUTRI_KEYS["sodium"]),
                _pick(it, NUTRI_KEYS["origin"]),
            )
            if info is None:
                skipped_basis += 1
                continue
            out[str(rep).strip()] = info
        page += 1
    print(f"  영양 API {len(out)}건 수집 (기준량 비100g 제외 {skipped_basis}건)", file=sys.stderr)
    if not out:
        print("  ⚠ 영양 API 매칭 0건 — --dump-keys 로 실제 필드명을 확인해 NUTRI_KEYS 를 보정하세요.", file=sys.stderr)
    return out


def parse_nutrition_csv(path: Path) -> dict[str, dict]:
    """포털에서 내려받은 #15100066 CSV 를 한글 헤더(확정 스펙)로 파싱."""
    def read_rows(encoding: str) -> list[dict]:
        with path.open(encoding=encoding, newline="") as f:
            return list(csv.DictReader(f))

    try:
        rows = read_rows("utf-8-sig")
    except UnicodeDecodeError:
        rows = read_rows("cp949")
    if not rows:
        return {}

    headers = list(rows[0].keys())

    def col(*needles: str, exclude: tuple[str, ...] = ()) -> str | None:
        for h in headers:
            if any(n in h for n in needles) and not any(x in h for x in exclude):
                return h
        return None

    c_rep = col("품목제조보고번호")
    c_kcal = col("에너지")
    c_carb = col("탄수화물")
    c_prot = col("단백질")
    c_fat = col("지방(", exclude=("포화", "트랜스"))
    c_sugar = col("당류")
    c_sodium = col("나트륨")
    c_basis = col("영양성분함량기준량")
    c_origin = col("원산지국명")
    if not c_rep or not c_kcal:
        print(f"  ⚠ CSV 헤더에서 품목제조보고번호/에너지 컬럼을 찾지 못함: {headers[:8]}...", file=sys.stderr)
        return {}

    out: dict[str, dict] = {}
    skipped_basis = 0
    for r in rows:
        rep = (r.get(c_rep) or "").strip()
        if not rep:
            continue
        info = _nutri_info(
            r.get(c_basis) if c_basis else None,
            r.get(c_kcal),
            r.get(c_carb) if c_carb else None,
            r.get(c_prot) if c_prot else None,
            r.get(c_fat) if c_fat else None,
            r.get(c_sugar) if c_sugar else None,
            r.get(c_sodium) if c_sodium else None,
            r.get(c_origin) if c_origin else None,
        )
        if info is None:
            skipped_basis += 1
            continue
        out[rep] = info
    print(f"  영양 CSV {len(out)}건 파싱 (기준량 비100g 제외 {skipped_basis}건)", file=sys.stderr)
    return out


def attach_nutrition(rows: list[dict], nutri: dict[str, dict]) -> int:
    """품목제조보고번호 exact join 으로 영양 필드 부착. 미매칭은 그대로(null) — 추정 채움 금지."""
    matched = 0
    for r in rows:
        rep = r.get("itemReportNo")
        info = nutri.get(rep) if rep else None
        if info:
            r.update({k: v for k, v in info.items() if v is not None})
            matched += 1
    return matched


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
            payload: dict = {
                "name": str(r["name"])[:200],
                "price": int(r["price"]),
                "stock": int(r.get("stock", 100)),
                "brand": str(brand)[:100] if brand else None,
                "description": str(desc)[:2000] if desc else None,
                "category": str(r.get("category") or "")[:100] or None,
            }
            # 영양/원재료/원산지/조인키 — 값 있는 필드만 (ADR-0059)
            for f in NUTRITION_FIELDS:
                if r.get(f) is not None:
                    payload[f] = r[f]
            if r.get("ingredients"):
                payload["ingredients"] = str(r["ingredients"])[:2000]
            if r.get("originCountry"):
                payload["originCountry"] = str(r["originCountry"])[:64]
            if r.get("itemReportNo"):
                payload["itemReportNo"] = str(r["itemReportNo"])[:30]
            dst.write(json.dumps(payload, ensure_ascii=False) + "\n")
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
    # 영양/원재료 (ADR-0059)
    ap.add_argument("--nutrition-csv", help="#15100066 CSV 파일 경로 (한글 헤더 파싱, API 대신 사용 — 권장)")
    ap.add_argument("--no-nutrition", action="store_true", help="영양 조인 생략")
    ap.add_argument("--nutrition-limit", type=int, default=20000, help="영양 API 최대 수집 행수")
    ap.add_argument("--dump-keys", action="store_true", help="영양 API 첫 행의 실제 필드명 출력 후 종료 (진단)")
    ap.add_argument("--ingredients", action="store_true", help="C002 원재료 텍스트 조인 (건당 1콜 — 느림)")
    ap.add_argument("--ingredients-cap", type=int, default=300, help="원재료 조회 상한 (영양 매칭 상품 우선)")
    args = ap.parse_args()
    out = Path(args.out)

    source = "sample" if args.from_sample else args.source

    if source == "sample":
        n = normalize_from_sample(out)
        print(f"[sample] {n} products → {out}", file=sys.stderr)
        return 0

    key = os.environ.get("DATA_GO_KR_KEY")
    mfds_key = os.environ.get("MFDS_KEY") or key
    if not key:
        print("DATA_GO_KR_KEY 미설정 → 샘플로 폴백", file=sys.stderr)
        n = normalize_from_sample(out)
        print(f"[sample] {n} products → {out}", file=sys.stderr)
        return 0

    if args.dump_keys:
        fetch_nutrition_api(key, limit=100, dump_keys=True)
        return 0

    if source == "chamgagyeok":
        records, _ = build_chamgagyeok(key, args.inspect_day)
        n = _emit(out, records)
        print(f"[chamgagyeok] {n} products (전량 실가격, 영양 미조인) → {out}", file=sys.stderr)
        return 0

    # 영양 룩업 (join/mfds 공통) — 품목제조보고번호 exact join
    nutri: dict[str, dict] = {}
    if args.nutrition_csv:
        nutri = parse_nutrition_csv(Path(args.nutrition_csv))
    elif not args.no_nutrition:
        nutri = fetch_nutrition_api(key, args.nutrition_limit)

    if source == "mfds":
        rows = [
            {**r, "price": _synthetic_price(r["name"], r["category"]), "stock": 100}
            for r in fetch_mfds(mfds_key, args.limit)
        ]
        stats_prefix = f"[mfds] (가격=합성)"
    else:
        # source == "join": 식약처 볼륨 + 참가격 실가격 조인
        cham_records, name_price = build_chamgagyeok(key, args.inspect_day)
        norm_keys = list(name_price.keys())
        rows = list(cham_records)  # 참가격 실가격 레코드는 그대로 포함
        seen = {_norm(r["name"]) for r in cham_records}

        matched = synth = dropped = 0
        for r in fetch_mfds(mfds_key, args.limit):
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
        stats_prefix = f"[join] (참가격 실가격 {len(cham_records)} + 식약처 매칭 {matched}, 합성 {synth}, 제외 {dropped})"

    nutri_matched = attach_nutrition(rows, nutri)

    if args.ingredients and mfds_key:
        # 영양 매칭된 상품 우선으로 원재료 조회 (cap 내)
        reps = [r["itemReportNo"] for r in rows if r.get("itemReportNo") and r.get("energyKcal") is not None]
        reps += [r["itemReportNo"] for r in rows if r.get("itemReportNo") and r.get("energyKcal") is None]
        ing = fetch_ingredients(mfds_key, reps, args.ingredients_cap)
        for r in rows:
            text = ing.get(r.get("itemReportNo") or "")
            if text:
                r["ingredients"] = text

    n = _emit(out, rows)
    print(f"{stats_prefix} {n} products → {out} | 영양 매칭 {nutri_matched}건", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
