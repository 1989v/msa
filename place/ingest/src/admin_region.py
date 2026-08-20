"""행정구역(법정동코드) 적재 (ADR-0071).

출처: 행정안전부 행정표준코드관리시스템 — **법정동코드 전체자료** (공공누리 제1유형).
자료는 브라우저로 한 번 내려받아 파일로 넘긴다. 다운로드가 세션·폼 파라미터에 묶여 있어
스크립트로 긁으면 정부 포털의 내부 폼을 역공학하는 셈이 된다.

    python3 -m src.main --job=admin-regions --file ~/Downloads/법정동코드_전체자료.txt

파일 형식 (탭 구분, CP949 또는 UTF-8):

    법정동코드      법정동명                    폐지여부
    1100000000      서울특별시                  존재
    1111000000      서울특별시 종로구            존재
    1111010100      서울특별시 종로구 청운동      존재

읍면동(뒤 5자리 != 00000)은 버린다 — 탐색 단위가 아니다.

시(수원시)와 그 자치구(수원시 장안구)가 **둘 다 5자리 코드**로 존재한다. 어느 쪽을 쓸지
여기서 정하지 않는다 — 관광지가 실제로 들고 있는 코드에만 건수가 붙으므로 화면이 건수로
가른다. 없는 계층을 우리가 지어내지 않는다.
"""
from __future__ import annotations

from pathlib import Path

from src import place_client

ALIVE = "존재"
CHUNK = 2000


def _read(path: Path) -> list[str]:
    raw = path.read_bytes()
    for encoding in ("utf-8-sig", "cp949", "euc-kr"):
        try:
            return raw.decode(encoding).splitlines()
        except UnicodeDecodeError:
            continue
    raise SystemExit(f"인코딩을 판별하지 못했습니다: {path}")


def parse(lines: list[str]) -> list[dict]:
    sido_names: dict[str, str] = {}
    regions: list[dict] = []

    for line in lines:
        parts = [p.strip() for p in line.split("\t")]
        if len(parts) < 2 or not parts[0].isdigit() or len(parts[0]) != 10:
            continue                      # 헤더·주석·깨진 줄
        code, name = parts[0], parts[1]
        if len(parts) >= 3 and parts[2] and parts[2] != ALIVE:
            continue                      # 폐지된 코드는 담지 않는다
        if code[5:] != "00000":
            continue                      # 읍면동

        if code[2:5] == "000":
            sido_names[code[:2]] = name
            regions.append({"code": code[:2], "level": "SIDO", "name": name})
        else:
            sido = sido_names.get(code[:2], "")
            # 화면에 "서울특별시 종로구" 대신 "종로구" 를 보인다 — 상위는 이미 골랐다.
            short = name[len(sido):].strip() if sido and name.startswith(sido) else name
            regions.append({
                "code": code[:5],
                "parentCode": code[:2],
                "level": "SIGUNGU",
                "name": short or name,
            })
    return regions


def locate(regions: list[dict]) -> list[dict]:
    """시군구 중심 좌표를 관광지 좌표 평균으로 채운다.

    법정동 자료에 좌표가 없다. 지도를 어디에 놓을지 정하는 값이라 행정 중심점일 필요가 없고,
    관광지가 없는 시군구는 좌표 없이 둔다 — 지어낸 좌표보다 없는 편이 낫다.
    """
    sums: dict[str, list[float]] = {}
    for row in place_client.fetch_attractions():
        regn, signgu = row.get("ldongRegnCd"), row.get("ldongSignguCd")
        lat, lng = row.get("latitude"), row.get("longitude")
        if not regn or not signgu or lat is None or lng is None:
            continue
        for key in (regn, f"{regn}{signgu}"):
            acc = sums.setdefault(key, [0.0, 0.0, 0.0])
            acc[0] += float(lat)
            acc[1] += float(lng)
            acc[2] += 1

    for region in regions:
        acc = sums.get(region["code"])
        if acc and acc[2] > 0:
            region["latitude"] = round(acc[0] / acc[2], 6)
            region["longitude"] = round(acc[1] / acc[2], 6)
    return regions


def upsert(regions: list[dict]) -> tuple[int, int]:
    created = updated = 0
    for i in range(0, len(regions), CHUNK):
        data = place_client._request(
            "POST", "/api/places/admin-regions/bulk",
            {"regions": regions[i:i + CHUNK]}, timeout=300,
        )["data"]
        created += int(data.get("created") or 0)
        updated += int(data.get("updated") or 0)
    return created, updated


def run(path: Path, with_coordinates: bool = True) -> list[dict]:
    regions = parse(_read(path))
    if not regions:
        raise SystemExit("적재할 행정구역이 없습니다 — 파일 형식을 확인하세요")
    if with_coordinates:
        regions = locate(regions)
    return regions
