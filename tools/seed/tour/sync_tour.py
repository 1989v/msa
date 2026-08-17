#!/usr/bin/env python3
"""ADR-0065 — TourAPI 4.0 → 관광지 시드(JSONL) 정규화기.

한국관광공사 TourAPI 의 국문(KorService2)/영문(EngService2) 지역기반 목록을
place 서비스 bulk API(/api/places/attractions/bulk)가 읽는 attractions JSONL 로 정규화한다.
국문/영문은 contentId 체계가 달라 언어별 별도 레코드(lang: ko|en)로 만든다 (ADR-0065).

소스 & 라이선스:
  - 한국관광공사 TourAPI 4.0 (data.go.kr 활용신청, 공공누리 — 출처표시)
      KorService2 (국문) / EngService2 (영문): areaBasedList2, detailCommon2(overview).
  원천 raw 응답은 레포에 커밋하지 않는다. 정규화된 JSONL 만 적재에 사용.
  화면/문서 출처표기: "한국관광공사 TourAPI".

키: TOUR_API_KEY (data.go.kr Encoding 키, 추가 인코딩 금지. 미설정 시 DATA_GO_KR_KEY 재사용)

사용:
  export TOUR_API_KEY='...(Encoding 서비스키)...'
  python3 sync_tour.py --service kor --out attractions.jsonl                # 국문 관광지 전국
  python3 sync_tour.py --service eng --out attractions.en.jsonl            # 영문
  python3 sync_tour.py --service kor --area 1 --limit 500                  # 서울만
  python3 sync_tour.py --service kor --with-overview --overview-cap 200    # 개요 조인(건당 1콜)
  python3 sync_tour.py --dump-keys                                         # 첫 행 실제 필드 진단
  python3 sync_tour.py --from-sample --out attractions.jsonl               # 키 없이 동봉 샘플(30건)

출력 한 줄 스키마(값 없는 필드는 생략):
  {"contentId","lang","title","address","areaCode","sigunguCode","category",
   "cat1","cat2","cat3","latitude","longitude","imageUrl","tel","overview","sourceModifiedAt"}
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

HERE = Path(__file__).resolve().parent
SAMPLE = HERE / "attractions.sample.jsonl"

BASE = "https://apis.data.go.kr/B551011"
SERVICES = {"kor": ("KorService2", "ko"), "eng": ("EngService2", "en")}

# 관광 타입 → 서비스별 contentTypeId (국문/영문 코드 체계가 다르다)
CONTENT_TYPES = {
    "attraction": {"kor": "12", "eng": "76"},
    "culture": {"kor": "14", "eng": "78"},
    "leisure": {"kor": "28", "eng": "75"},
    "shopping": {"kor": "38", "eng": "79"},
    "food": {"kor": "39", "eng": "82"},
}

# TourAPI cat1/cat2 → 자체 카테고리 슬러그 (언어 중립 — FE 가 로케일 라벨 렌더)
CAT2_OVERRIDE = {"A0201": "history", "A0202": "nature"}
CAT1_MAP = {"A01": "nature", "A02": "culture", "A03": "leisure", "A04": "shopping", "A05": "food", "B02": "stay"}

# TourAPI 4.0 신규 분류체계(lclsSystm1) 폴백.
# cat1 이 비는 응답이 있어(아래 AREA_CODES 주석 참조) 이쪽으로 받아낸다.
LCLS1_MAP = {"NA": "nature", "HS": "history", "EX": "leisure", "VE": "culture",
             "AC": "stay", "FD": "food", "SH": "shopping", "LS": "leisure", "EV": "culture"}


def categorize(cat1: str, cat2: str, lcls1: str = "") -> str:
    """구 분류(cat1/cat2)를 우선하고, 비면 신규 분류체계로 받아낸다."""
    return (CAT2_OVERRIDE.get(cat2)
            or CAT1_MAP.get(cat1)
            or LCLS1_MAP.get(lcls1, "etc"))


# areaBasedList2 는 **areaCode 를 지정하지 않으면 areacode·cat1~3 을 빈 문자열로 돌려준다**
# (2026-08 실측: 무지정 300건 전부 결측, 지역 지정 시 정상). 전국 수집은 지역을 순회해야
# 지역 필터와 카테고리가 살아난다. 목록은 areaCode2 오퍼레이션 실측값.
AREA_CODES = ["1", "2", "3", "4", "5", "6", "7", "8",
              "31", "32", "33", "34", "35", "36", "37", "38", "39"]


def http_json(url: str) -> dict:
    with urlopen(url, timeout=30) as res:
        return json.loads(res.read().decode("utf-8"))


def tour_get(key: str, service: str, op: str, params: dict) -> dict:
    qs = urlencode({"MobileOS": "ETC", "MobileApp": "msa-seed", "_type": "json", **params})
    # Encoding 키는 이미 URL-인코딩돼 있어 그대로 붙인다 (이중 인코딩 금지)
    url = f"{BASE}/{service}/{op}?serviceKey={key}&{qs}"
    data = http_json(url)
    header = data.get("response", {}).get("header", {})
    if header.get("resultCode") not in ("0000", "00"):
        raise SystemExit(f"[tourapi] {op} 실패: {header.get('resultCode')} {header.get('resultMsg')}")
    return data["response"]["body"]


def parse_modified(raw: str) -> str | None:
    # modifiedtime: yyyyMMddHHmmss → ISO LocalDateTime
    if not raw or len(raw) < 8:
        return None
    raw = raw.ljust(14, "0")
    return f"{raw[0:4]}-{raw[4:6]}-{raw[6:8]}T{raw[8:10]}:{raw[10:12]}:{raw[12:14]}"


def fetch_area_based(key: str, svc_key: str, content_type: str, area: str | None,
                     limit: int, dump_keys: bool) -> list[dict]:
    service, lang = SERVICES[svc_key]
    type_id = CONTENT_TYPES[content_type][svc_key]
    rows, page = [], 1
    while len(rows) < limit:
        params = {"numOfRows": min(100, limit - len(rows)), "pageNo": page,
                  "contentTypeId": type_id, "arrange": "C"}
        if area:
            params["areaCode"] = area
        body = tour_get(key, service, "areaBasedList2", params)
        items = body.get("items") or {}
        item_list = items.get("item") if isinstance(items, dict) else None
        if not item_list:
            break
        if isinstance(item_list, dict):
            item_list = [item_list]
        if dump_keys:
            print(json.dumps(item_list[0], ensure_ascii=False, indent=2))
            return []
        for it in item_list:
            lat, lng = it.get("mapy"), it.get("mapx")
            if not lat or not lng:
                continue  # 좌표 없는 행은 지도/근방검색에 못 쓴다 — 제외
            rows.append({
                "contentId": str(it["contentid"]),
                "lang": lang,
                "title": (it.get("title") or "").strip(),
                "address": " ".join(x for x in (it.get("addr1"), it.get("addr2")) if x).strip() or None,
                "areaCode": str(it.get("areacode") or "") or None,
                "sigunguCode": str(it.get("sigungucode") or "") or None,
                "category": categorize(it.get("cat1") or "", it.get("cat2") or "",
                                       it.get("lclsSystm1") or ""),
                "cat1": it.get("cat1") or None,
                "cat2": it.get("cat2") or None,
                "cat3": it.get("cat3") or None,
                "latitude": float(lat),
                "longitude": float(lng),
                "imageUrl": it.get("firstimage") or None,
                "tel": (it.get("tel") or "").strip() or None,
                "sourceModifiedAt": parse_modified(str(it.get("modifiedtime") or "")),
            })
        total = int(body.get("totalCount") or 0)
        if page * 100 >= total:
            break
        page += 1
        time.sleep(0.2)  # 호출량 예의
    return [r for r in rows if r["title"]][:limit]


def join_overview(key: str, svc_key: str, rows: list[dict], cap: int) -> None:
    service, _ = SERVICES[svc_key]
    for row in rows[:cap]:
        try:
            body = tour_get(key, service, "detailCommon2", {"contentId": row["contentId"]})
            items = body.get("items") or {}
            item = items.get("item") if isinstance(items, dict) else None
            if isinstance(item, list):
                item = item[0] if item else None
            overview = (item or {}).get("overview")
            if overview:
                row["overview"] = overview.strip()
        except Exception as e:  # overview 는 best-effort — 실패해도 목록은 유효
            print(f"[overview] {row['contentId']} 스킵: {e}", file=sys.stderr)
        time.sleep(0.2)


def write_jsonl(rows: list[dict], out: Path) -> None:
    with out.open("w", encoding="utf-8") as f:
        for row in rows:
            f.write(json.dumps({k: v for k, v in row.items() if v is not None}, ensure_ascii=False) + "\n")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default="attractions.jsonl")
    ap.add_argument("--service", choices=["kor", "eng"], default="kor")
    ap.add_argument("--content-type", choices=list(CONTENT_TYPES), default="attraction")
    ap.add_argument("--area", help="TourAPI areaCode (1 서울, 6 부산, 39 제주 ...). 미지정 시 전국")
    ap.add_argument("--limit", type=int, default=2000)
    ap.add_argument("--with-overview", action="store_true", help="detailCommon2 개요 조인 (건당 1콜)")
    ap.add_argument("--overview-cap", type=int, default=200)
    ap.add_argument("--dump-keys", action="store_true", help="첫 행 원본 필드 출력 후 종료 (진단)")
    ap.add_argument("--from-sample", action="store_true", help="키 없이 동봉 샘플(ko 20 + en 10)")
    args = ap.parse_args()

    out = Path(args.out)
    if args.from_sample:
        rows = [json.loads(line) for line in SAMPLE.read_text(encoding="utf-8").splitlines() if line.strip()]
        write_jsonl(rows, out)
        print(f"[sample] {len(rows)} attractions → {out}")
        return 0

    key = os.environ.get("TOUR_API_KEY") or os.environ.get("DATA_GO_KR_KEY")
    if not key:
        raise SystemExit("TOUR_API_KEY(또는 DATA_GO_KR_KEY) 환경변수가 필요합니다. 샘플은 --from-sample.")

    if args.area or args.dump_keys:
        rows = fetch_area_based(key, args.service, args.content_type, args.area,
                                args.limit, args.dump_keys)
    else:
        # 전국 = 지역 순회. 무지정 호출은 areacode·cat1 이 비어 오므로 쓰지 않는다.
        rows, per_area = [], max(1, args.limit // len(AREA_CODES))
        for code in AREA_CODES:
            got = fetch_area_based(key, args.service, args.content_type, code, per_area, False)
            print(f"  area {code}: {len(got)}건", file=sys.stderr)
            rows.extend(got)
            if len(rows) >= args.limit:
                break
    if args.dump_keys:
        return 0
    if args.with_overview:
        join_overview(key, args.service, rows, args.overview_cap)
    write_jsonl(rows, out)
    print(f"[{args.service}/{args.content_type}] {len(rows)} attractions → {out}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
