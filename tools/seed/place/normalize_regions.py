#!/usr/bin/env python3
"""ADR-0056 Part 2 — GeoNames → 행정 지리 계층(regions.jsonl) 정규화기.

GeoNames 공개 덤프(키 불필요, CC BY 4.0)로 CONTINENT→COUNTRY→REGION(admin1)→CITY 계층을 만든다.
  - countryInfo.txt        : COUNTRY (continent code 로 대륙 연결)
  - admin1CodesASCII.txt   : REGION  (CC.admin1 → country 연결)
  - cities15000.zip        : CITY    (country + admin1 연결)

라이선스: GeoNames data is CC BY 4.0 — 상업/재배포 허용, 출처표시 필요(README 참조).
한국어명(nameKo)은 alternateNames 덤프(대용량)가 필요하여 기본 미포함. 샘플엔 수기로 포함.

사용:
  python3 normalize_regions.py --out regions.jsonl --max-cities 5000
  python3 normalize_regions.py --from-sample --out regions.jsonl   # 다운로드 없이 샘플 사용

출력 한 줄 스키마: PlaceSeedRunner.RegionSeedRecord 와 동일
  {level, name, nameKo?, countryCode?, admin1Code?, geonamesId, parentGeonamesId?, latitude?, longitude?, population?}
"""
from __future__ import annotations

import argparse
import io
import json
import sys
import zipfile
from pathlib import Path
from urllib.request import urlopen

HERE = Path(__file__).resolve().parent
SAMPLE = HERE / "regions.sample.jsonl"
BASE = "https://download.geonames.org/export/dump"

# 대륙코드 → GeoNames geonameId + 영문/한글명
CONTINENTS = {
    "AF": (6255146, "Africa", "아프리카"),
    "AS": (6255147, "Asia", "아시아"),
    "EU": (6255148, "Europe", "유럽"),
    "NA": (6255149, "North America", "북아메리카"),
    "SA": (6255150, "South America", "남아메리카"),
    "OC": (6255151, "Oceania", "오세아니아"),
    "AN": (6255152, "Antarctica", "남극"),
}


def _fetch(path: str) -> str:
    with urlopen(f"{BASE}/{path}", timeout=120) as resp:  # noqa: S310 (trusted)
        return resp.read().decode("utf-8")


def _fetch_zip_member(path: str, member: str) -> str:
    with urlopen(f"{BASE}/{path}", timeout=300) as resp:  # noqa: S310
        data = resp.read()
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        return zf.read(member).decode("utf-8")


def normalize_from_sample(out: Path) -> int:
    count = 0
    with SAMPLE.open(encoding="utf-8") as src, out.open("w", encoding="utf-8") as dst:
        for raw in src:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            rec = json.loads(line)
            dst.write(json.dumps(rec, ensure_ascii=False) + "\n")
            count += 1
    return count


def build(out: Path, max_cities: int) -> int:
    rows: list[dict] = []

    # CONTINENT
    for _code, (gid, name, name_ko) in CONTINENTS.items():
        rows.append({"level": "CONTINENT", "name": name, "nameKo": name_ko, "geonamesId": gid})

    # COUNTRY (countryInfo.txt) + cc → (countryGid) 맵
    country_gid: dict[str, int] = {}
    for line in _fetch("countryInfo.txt").splitlines():
        if not line or line.startswith("#"):
            continue
        c = line.split("\t")
        if len(c) < 17:
            continue
        iso, country, continent, gid = c[0], c[4], c[8], c[16]
        if not gid.isdigit():
            continue
        gid_i = int(gid)
        country_gid[iso] = gid_i
        cont = CONTINENTS.get(continent)
        rows.append({
            "level": "COUNTRY", "name": country, "countryCode": iso,
            "geonamesId": gid_i, "parentGeonamesId": cont[0] if cont else None,
        })

    # REGION (admin1CodesASCII.txt): "CC.admin1" → admin1Gid 맵
    admin1_gid: dict[str, int] = {}
    for line in _fetch("admin1CodesASCII.txt").splitlines():
        c = line.split("\t")
        if len(c) < 4 or not c[3].isdigit():
            continue
        code, name, gid = c[0], c[1], int(c[3])
        cc = code.split(".")[0]
        admin1_gid[code] = gid
        rows.append({
            "level": "REGION", "name": name, "countryCode": cc,
            "admin1Code": code.split(".")[1] if "." in code else None,
            "geonamesId": gid, "parentGeonamesId": country_gid.get(cc),
        })

    # CITY (cities15000.txt)
    city_lines = _fetch_zip_member("cities15000.zip", "cities15000.txt").splitlines()
    for line in city_lines[:max_cities]:
        c = line.split("\t")
        if len(c) < 15 or not c[0].isdigit():
            continue
        gid, name, lat, lon, cc, admin1, pop = (
            int(c[0]), c[1], c[4], c[5], c[8], c[10], c[14],
        )
        parent = admin1_gid.get(f"{cc}.{admin1}") or country_gid.get(cc)
        rows.append({
            "level": "CITY", "name": name, "countryCode": cc, "admin1Code": admin1 or None,
            "geonamesId": gid, "parentGeonamesId": parent,
            "latitude": float(lat) if lat else None,
            "longitude": float(lon) if lon else None,
            "population": int(pop) if pop.isdigit() else None,
        })

    with out.open("w", encoding="utf-8") as dst:
        for r in rows:
            dst.write(json.dumps(r, ensure_ascii=False) + "\n")
    return len(rows)


def main() -> int:
    ap = argparse.ArgumentParser(description="GeoNames → regions.jsonl 정규화기")
    ap.add_argument("--out", default="regions.jsonl")
    ap.add_argument("--max-cities", type=int, default=5000)
    ap.add_argument("--from-sample", action="store_true")
    args = ap.parse_args()
    out = Path(args.out)

    if args.from_sample:
        n = normalize_from_sample(out)
        print(f"[from-sample] {n} regions → {out}", file=sys.stderr)
        return 0

    try:
        n = build(out, args.max_cities)
        print(f"[geonames] {n} regions → {out}", file=sys.stderr)
    except Exception as e:  # noqa: BLE001
        print(f"GeoNames 다운로드 실패({e}) → 샘플로 폴백", file=sys.stderr)
        n = normalize_from_sample(out)
        print(f"[from-sample] {n} regions → {out}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
