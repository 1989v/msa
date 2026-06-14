#!/usr/bin/env python3
"""ADR-0056 Part 2 — 소상공인 상가정보 → POI 시드(pois.jsonl) 정규화기.

소상공인시장진흥공단 상가(상권)정보 OpenAPI(data.go.kr #15083033, 이용허락범위 제한없음)의
반경 조회(storeListInRadius)로 특정 중심 좌표 주변 상가를 받아 POI JSONL 로 정규화한다.

라이선스: 상가정보는 data.go.kr '이용허락범위 제한없음' — 상업/재배포 OK (출처표시 권장).

사용:
  export DATA_GO_KR_KEY='...(디코딩 서비스키)...'
  # 강남구청(127.0473, 37.5172) 반경 2km 음식점(I2):
  python3 normalize_pois.py --cx 127.0473 --cy 37.5172 --radius 2000 --inds I2 --out pois.jsonl
  python3 normalize_pois.py --from-sample --out pois.jsonl   # 키 없이 샘플 사용

출력 한 줄 스키마: PlaceSeedRunner.PoiSeedRecord 와 동일
  {source, sourceKey, name, latitude, longitude, categoryMajor, categoryMid, categorySub?, roadAddress?, jibunAddress?}
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen

HERE = Path(__file__).resolve().parent
SAMPLE = HERE / "pois.sample.jsonl"
# 소상공인 상가정보 v2 반경 조회
ENDPOINT = "https://apis.data.go.kr/B553077/api/open/sdsc2/storeListInRadius"


def _http_json(url: str) -> dict:
    with urlopen(url, timeout=60) as resp:  # noqa: S310 (trusted gov endpoint)
        return json.load(resp)


def normalize_from_sample(out: Path) -> int:
    count = 0
    with SAMPLE.open(encoding="utf-8") as src, out.open("w", encoding="utf-8") as dst:
        for raw in src:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            dst.write(json.dumps(json.loads(line), ensure_ascii=False) + "\n")
            count += 1
    return count


def fetch_radius(key: str, cx: float, cy: float, radius: int, inds: str | None, limit: int) -> list[dict]:
    rows: list[dict] = []
    page, page_size = 1, 100
    while len(rows) < limit:
        params = {
            "serviceKey": key, "type": "json", "radius": radius,
            "cx": cx, "cy": cy, "numOfRows": page_size, "pageNo": page,
        }
        if inds:
            params["indsLclsCd"] = inds  # 예: I2(음식)
        data = _http_json(f"{ENDPOINT}?{urlencode(params)}")
        items = (((data.get("body") or {}).get("items")) or [])
        if not items:
            break
        for it in items:
            lat, lon = it.get("lat"), it.get("lon")
            name = it.get("bizesNm")
            if not (lat and lon and name):
                continue
            rows.append({
                "source": "SANGGA",
                "sourceKey": str(it.get("bizesId") or f"{name}-{lat}-{lon}"),
                "name": name,
                "latitude": float(lat),
                "longitude": float(lon),
                "categoryMajor": it.get("indsLclsNm"),
                "categoryMid": it.get("indsMclsNm"),
                "categorySub": it.get("indsSclsNm"),
                "roadAddress": it.get("rdnmAdr"),
                "jibunAddress": it.get("lnoAdr"),
            })
        page += 1
    return rows[:limit]


def main() -> int:
    ap = argparse.ArgumentParser(description="상가정보 → pois.jsonl 정규화기")
    ap.add_argument("--out", default="pois.jsonl")
    ap.add_argument("--cx", type=float, default=127.0473, help="중심 경도(lon)")
    ap.add_argument("--cy", type=float, default=37.5172, help="중심 위도(lat)")
    ap.add_argument("--radius", type=int, default=2000, help="반경(m)")
    ap.add_argument("--inds", default="I2", help="상권업종 대분류코드 (I2=음식). 미지정 시 전체")
    ap.add_argument("--limit", type=int, default=1000)
    ap.add_argument("--from-sample", action="store_true")
    args = ap.parse_args()
    out = Path(args.out)

    if args.from_sample:
        n = normalize_from_sample(out)
        print(f"[from-sample] {n} POIs → {out}", file=sys.stderr)
        return 0

    key = os.environ.get("DATA_GO_KR_KEY")
    if not key:
        print("DATA_GO_KR_KEY 미설정 → 샘플로 폴백", file=sys.stderr)
        n = normalize_from_sample(out)
        print(f"[from-sample] {n} POIs → {out}", file=sys.stderr)
        return 0

    try:
        rows = fetch_radius(key, args.cx, args.cy, args.radius, args.inds or None, args.limit)
        with out.open("w", encoding="utf-8") as dst:
            for r in rows:
                dst.write(json.dumps(r, ensure_ascii=False) + "\n")
        print(f"[sangga] {len(rows)} POIs → {out}", file=sys.stderr)
    except Exception as e:  # noqa: BLE001
        print(f"상가정보 API 실패({e}) → 샘플로 폴백", file=sys.stderr)
        n = normalize_from_sample(out)
        print(f"[from-sample] {n} POIs → {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
