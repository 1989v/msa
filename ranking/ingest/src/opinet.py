"""오피넷(한국석유공사) 유가정보 API 클라이언트 (ADR-0081).

**유료 오퍼레이션은 부르지 않는다.** `최저가 Top20`·`시군구 평균가` 는 유료지만, 무료
`주유소 기본정보(지역별)` 로 전량을 받아 두면 같은 결과를 우리가 직접 집계할 수 있다.

한도 초과를 만나면 **그 실행을 즉시 멈춘다**([QuotaExceeded]). 부분 적재를 남기면 적재가
전체 동기화라 다음 실행이 나머지를 지운다.

> 오퍼레이션 경로와 파라미터 이름은 키 발급 후 받는 개발 가이드가 원본이다. 여기 값이
> 어긋나면 [OPERATIONS] 한 곳만 고친다 (open-questions OQ-4/OQ-6).
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request

BASE = os.environ.get("OPINET_API", "https://www.opinet.co.kr/api").rstrip("/")

OPERATIONS = {
    "area_code": "areaCode.do",       # 지역코드 조회 (무료)
    "area_stations": "areaPrice.do",  # 주유소 기본정보(지역별) (무료)
    "detail": "detailById.do",        # 주유소 상세정보 (무료)
    "around": "aroundAll.do",         # 반경 내 주유소 검색 (무료)
    "avg_all": "avgAllPrice.do",      # 전국 평균가격 (무료)
}

# 유종 코드. 발급 가이드에서 확인해 여기서만 고친다 (OQ-6).
PRODUCT_GASOLINE = "B027"   # 휘발유
PRODUCT_DIESEL = "D047"     # 경유
PRODUCTS = (PRODUCT_GASOLINE, PRODUCT_DIESEL)

_RETRY_WAITS = (2, 5, 10)
_TIMEOUT = 30


class QuotaExceeded(RuntimeError):
    """일일 한도 초과 — 이 실행은 여기서 끝난다."""


def log(message: str) -> None:
    print(f"[OPINET] {message}", flush=True)


def _call(operation: str, params: dict[str, str], key: str) -> dict:
    query = urllib.parse.urlencode({"code": key, "out": "json", **params})
    url = f"{BASE}/{OPERATIONS[operation]}?{query}"

    for wait in (*_RETRY_WAITS, None):
        try:
            with urllib.request.urlopen(url, timeout=_TIMEOUT) as response:
                body = response.read().decode("utf-8", errors="replace")
            break
        except urllib.error.HTTPError as e:
            if e.code == 429:
                raise QuotaExceeded(f"{operation} 429 — 일일 한도 초과")
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if wait is None:
                raise
            time.sleep(wait)
    else:  # pragma: no cover - 위 for 는 break 또는 raise 로만 끝난다
        raise RuntimeError(f"{operation} 호출 실패")

    # 한도 초과가 200 + 본문 메시지로 오는 경우가 있다 — 상태코드만 보면 못 잡는다.
    if "한도" in body or "초과" in body.upper() or "LIMIT" in body.upper():
        raise QuotaExceeded(f"{operation} 응답이 한도 초과를 알린다: {body[:120]}")

    try:
        return json.loads(body)
    except json.JSONDecodeError:
        raise RuntimeError(f"{operation} 응답이 JSON 이 아니다: {body[:200]}")


def _rows(payload: dict) -> list[dict]:
    """오피넷은 `{"RESULT": {"OIL": [...]}}` 로 답한다. 키 이름이 오퍼레이션마다 조금씩 다르다."""
    result = payload.get("RESULT") or payload.get("result") or {}
    for key in ("OIL", "oil", "AREA", "area"):
        rows = result.get(key)
        if isinstance(rows, list):
            return rows
    return []


def fetch_areas(key: str) -> list[dict]:
    """시도 → 시군구 지역코드. place 서비스를 부르지 않고 오피넷 코드계를 그대로 쓴다."""
    sido = _rows(_call("area_code", {"area": "SIDO"}, key))
    areas: list[dict] = []
    for row in sido:
        code = str(row.get("AREA_CD") or row.get("area_cd") or "").strip()
        name = str(row.get("AREA_NM") or row.get("area_nm") or "").strip()
        if not code:
            continue
        areas.append({"code": code, "name": name, "level": "SIDO", "parent": None})
        for child in _rows(_call("area_code", {"area": "SIGUN", "code": code}, key)):
            child_code = str(child.get("AREA_CD") or "").strip()
            if not child_code:
                continue
            areas.append({
                "code": child_code,
                "name": str(child.get("AREA_NM") or "").strip(),
                "level": "SIGUN",
                "parent": code,
            })
    return areas


def _flag(row: dict, *keys: str) -> bool | None:
    for key in keys:
        value = row.get(key)
        if value in ("Y", "N"):
            return value == "Y"
    return None


def _decimal(row: dict, *keys: str) -> float | None:
    for key in keys:
        value = row.get(key)
        if value in (None, "", "-"):
            continue
        try:
            return float(value)
        except (TypeError, ValueError):
            continue
    return None


def parse_station(row: dict, product_code: str, area: dict | None = None) -> dict:
    """원천 한 줄 → 적재용 dict. 좌표 변환은 호출자가 한다(원천 값을 그대로 남기기 위해)."""
    price = row.get("PRICE") or row.get("price")
    return {
        "opinetId": str(row.get("UNI_ID") or row.get("uni_id") or "").strip(),
        "name": str(row.get("OS_NM") or row.get("os_nm") or "").strip(),
        "brandCode": (str(row.get("POLL_DIV_CD") or row.get("POLL_DIV_CO") or "").strip() or None),
        "isSelf": _flag(row, "SELF_YN") or False,
        "katecX": _decimal(row, "GIS_X_COOR", "gis_x_coor"),
        "katecY": _decimal(row, "GIS_Y_COOR", "gis_y_coor"),
        "areaCode": (area or {}).get("code"),
        "areaName": (area or {}).get("name"),
        "roadAddress": (str(row.get("NEW_ADR") or "").strip() or None),
        "jibunAddress": (str(row.get("VAN_ADR") or "").strip() or None),
        "tel": (str(row.get("TEL") or "").strip() or None),
        "hasCarWash": _flag(row, "CAR_WASH_YN"),
        "hasMaintenance": _flag(row, "MAINT_YN"),
        "hasCvs": _flag(row, "CVS_YN"),
        "prices": [{"productCode": product_code, "price": int(float(price))}] if price else [],
    }


def fetch_area_stations(key: str, area: dict, product_code: str) -> list[dict]:
    """한 지역 × 한 유종의 주유소 목록."""
    payload = _call("area_stations", {"area": area["code"], "prodcd": product_code}, key)
    parsed = [parse_station(row, product_code, area) for row in _rows(payload)]
    return [row for row in parsed if row["opinetId"]]
