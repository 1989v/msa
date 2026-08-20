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


# 법정동 자료에 영문이 없다 (컬럼은 법정동코드/법정동명/폐지여부 뿐). 시도 17개는 확립된 공식
# 표기라 여기 고정한다 — 관광지 영문 주소에서 뽑으면 원천 오류를 물려받는다. 실측(2026-08-20):
# `Jeonnam-Gwangju Special Metropolitan City` 568건이 전남과 광주를 뭉개서 둘 다 그 이름이 된다.
# 이름이 아니라 **코드**로 잡는 이유: 한글명은 바뀐다(강원도 → 강원특별자치도). 코드는 안 바뀐다.
SIDO_EN = {
    "11": "Seoul",            "26": "Busan",              "27": "Daegu",
    "28": "Incheon",          "29": "Gwangju",            "30": "Daejeon",
    "31": "Ulsan",            "36": "Sejong",             "41": "Gyeonggi-do",
    "42": "Gangwon-do",       "43": "Chungcheongbuk-do",  "44": "Chungcheongnam-do",
    "45": "Jeonbuk-do",       "46": "Jeollanam-do",       "47": "Gyeongsangbuk-do",
    "48": "Gyeongsangnam-do", "50": "Jeju-do",
}


def _english_sigungu(korean_name: str, address: str) -> str | None:
    """영문 주소에서 그 시군구의 영문명을 꺼낸다.

    `tokens[-2]` 로 고정하면 안 된다 — 시 아래 자치구가 있으면 한 칸 밀린다.

        99 Girin-daero, Wansan-gu, Jeonju-si, Jeollabuk-do
                        └ 완산구      └ 전주시

    어느 칸을 볼지는 **법정동 한글명의 단어 수**가 정한다. `종로구`(1단어)는 tokens[-2],
    `전주시 완산구`(2단어)는 tokens[-3]+tokens[-2] 다. 한글 구조를 그대로 따라가면 어긋나지 않는다.
    """
    tokens = [t.strip() for t in address.split(",") if t.strip()]
    words = len(korean_name.split())
    if words >= 2:
        if len(tokens) < 3:
            return None
        candidate = f"{tokens[-3]}, {tokens[-2]}"
    else:
        if len(tokens) < 2:
            return None
        candidate = tokens[-2]
    # 도로명·건물번호가 섞여 들어온 것은 버린다 (주소 형식이 깨진 레코드)
    if any(ch.isdigit() for ch in candidate):
        return None
    return candidate


def enrich(regions: list[dict]) -> list[dict]:
    """좌표와 영문명을 관광지 데이터에서 채운다 — 추가 API 호출 0.

    좌표: 법정동 자료에 없다. 지도를 어디에 놓을지 정하는 값이라 행정 중심점일 필요가 없어
    그 지역 관광지 좌표의 평균으로 둔다.

    영문명: 시도는 위 상수, 시군구는 **영문 관광지 주소의 최빈값**. 최빈값을 쓰는 이유는
    같은 시군구에 표기가 여럿 섞여 있어서다(`Busan` 1,026 vs `Busan-si` 62).

    둘 다 관광지가 없는 시군구는 비워 둔다 — 지어낸 값보다 없는 편이 낫다.
    """
    by_code = {r["code"]: r for r in regions}
    coords: dict[str, list[float]] = {}
    names: dict[str, dict[str, int]] = {}

    for row in place_client.fetch_attractions():
        regn, signgu = row.get("ldongRegnCd"), row.get("ldongSignguCd")
        if not regn:
            continue
        lat, lng = row.get("latitude"), row.get("longitude")
        if lat is not None and lng is not None:
            for key in filter(None, (regn, f"{regn}{signgu}" if signgu else None)):
                acc = coords.setdefault(key, [0.0, 0.0, 0.0])
                acc[0] += float(lat)
                acc[1] += float(lng)
                acc[2] += 1

        if row.get("lang") != "en" or not signgu:
            continue
        region = by_code.get(f"{regn}{signgu}")
        address = (row.get("address") or "").strip()
        if not region or not address:
            continue
        english = _english_sigungu(region["name"], address)
        if english:
            bucket = names.setdefault(region["code"], {})
            bucket[english] = bucket.get(english, 0) + 1

    for region in regions:
        acc = coords.get(region["code"])
        if acc and acc[2] > 0:
            region["latitude"] = round(acc[0] / acc[2], 6)
            region["longitude"] = round(acc[1] / acc[2], 6)

        if region["level"] == "SIDO":
            english = SIDO_EN.get(region["code"])
        else:
            bucket = names.get(region["code"])
            english = max(bucket, key=bucket.get) if bucket else None
        if english:
            region["nameEn"] = english
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


def run(path: Path, with_enrichment: bool = True) -> list[dict]:
    regions = parse(_read(path))
    if not regions:
        raise SystemExit("적재할 행정구역이 없습니다 — 파일 형식을 확인하세요")
    return enrich(regions) if with_enrichment else regions
