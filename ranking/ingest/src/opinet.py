"""유가정보 API 클라이언트 — 공공데이터포털(data.go.kr) 경유 (ADR-0081).

데이터 주인은 한국석유공사(오피넷)지만 **호출은 공공데이터포털로 한다.** 이 프로젝트는 참가격·
식약처·TourAPI 때문에 이미 `DATA_GO_KR_KEY` 를 갖고 있어 별도 가입이 필요 없기 때문이다.

포털이 제공하는 것은 5종뿐이다 — 지역코드 · 지역별 최저가 TOP20 · 반경 내 주유소(5km) ·
주유소 상세정보(ID) · 전국 평균가격. **지역 단위 전량+가격은 여기 없다**(오피넷 직접 신청에만
있다). 그래서 수집은 시군구 × 유종의 **최저가 TOP20** 을 모으는 방식이다 —
"최저가 랭킹"이 목적이라 데이터셋이 목적과 정확히 겹친다.

> 엔드포인트 주소와 오퍼레이션 이름은 **활용신청 후 받는 API 명세서가 원본**이다.
> 어긋나면 [OPERATIONS] 와 `OIL_API_BASE` 두 곳만 고친다 (open-questions OQ-4/OQ-6).
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET

# 활용신청 화면의 End Point 를 그대로 넣는다. **기본값을 두지 않는다** — 틀린 주소로 부르면
# 404 를 200 처럼 삼키거나 조용히 빈 목록이 되어, 새벽에 도는 배치가 아무 말 없이 실패한다.
BASE = os.environ.get("OIL_API_BASE", "").rstrip("/")

OPERATIONS = {
    "area_code": "areaCode",       # 지역코드 조회
    "low_top": "lowTop20",         # 지역별 최저가 주유소 TOP20 (가격 포함)
    "around": "aroundAll",         # 반경 내 주유소 (5km, 가격 포함)
    "detail": "detailById",        # 주유소 상세정보(ID)
    "avg_all": "avgAllPrice",      # 전국 평균가격
}

# 유종 코드. 발급 가이드에서 확인해 여기서만 고친다 (OQ-6).
PRODUCT_GASOLINE = "B027"   # 휘발유
PRODUCT_DIESEL = "D047"     # 경유
PRODUCTS = (PRODUCT_GASOLINE, PRODUCT_DIESEL)

# 공공데이터포털의 표준 오류 코드. **HTTP 는 200 인 채로 본문에 담겨 온다** —
# 상태코드만 보면 한도 초과를 성공으로 읽는다.
QUOTA_CODES = {"22", "LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR"}
AUTH_CODES = {"30", "SERVICE_KEY_IS_NOT_REGISTERED_ERROR", "31", "DEADLINE_HAS_EXPIRED_ERROR"}

_RETRY_WAITS = (2, 5, 10)
_TIMEOUT = 30


class QuotaExceeded(RuntimeError):
    """일일 한도 초과 — 이 실행은 여기서 끝난다."""


class ApiNotConfigured(RuntimeError):
    """엔드포인트나 키가 없다 — 부르지 않고 멈춘다."""


def log(message: str) -> None:
    print(f"[OILAPI] {message}", flush=True)


def _fetch(operation: str, params: dict[str, str], key: str) -> str:
    if not BASE:
        raise ApiNotConfigured("OIL_API_BASE 가 필요합니다 (활용신청 화면의 End Point)")

    # serviceKey 는 **Encoding 키를 그대로** 넣는다. urlencode 가 다시 인코딩하면
    # 퍼센트가 이중으로 escape 돼 인증이 깨진다 (참가격 적재에서 겪은 것과 같은 함정).
    query = urllib.parse.urlencode({"out": "json", **params})
    url = f"{BASE}/{OPERATIONS[operation]}?serviceKey={key}&{query}"

    for wait in (*_RETRY_WAITS, None):
        try:
            with urllib.request.urlopen(url, timeout=_TIMEOUT) as response:
                return response.read().decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            if e.code == 429:
                raise QuotaExceeded(f"{operation} 429")
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            if wait is None:
                raise
            time.sleep(wait)
    raise RuntimeError("unreachable")


def _result_code(body: str) -> str | None:
    """포털 오류 봉투에서 resultCode 를 꺼낸다. JSON 도 XML 도 같은 이름을 쓴다."""
    if "resultCode" not in body and "returnReasonCode" not in body:
        return None
    try:
        root = ET.fromstring(body)
        for tag in ("resultCode", "returnReasonCode"):
            node = root.find(f".//{tag}")
            if node is not None and node.text:
                return node.text.strip()
    except ET.ParseError:
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            return None
        header = (payload.get("response") or {}).get("header") or {}
        code = header.get("resultCode") or header.get("returnReasonCode")
        return str(code).strip() if code is not None else None
    return None


def _rows(body: str) -> list[dict]:
    """응답 본문 → 레코드 목록.

    포털이 XML 을 기본으로 주고 오퍼레이션에 따라 JSON 도 준다. 게다가 이 API 들은
    오피넷 원본 모양(`{"RESULT": {"OIL": [...]}}`)이 그대로 실려 오기도 한다.
    셋 중 무엇이 와도 같은 목록으로 만든다 — 어느 쪽인지는 불러봐야 안다.
    """
    code = _result_code(body)
    if code in QUOTA_CODES:
        raise QuotaExceeded(f"일일 한도 초과 (resultCode={code})")
    if code in AUTH_CODES:
        raise ApiNotConfigured(f"키가 등록되지 않았거나 만료됐다 (resultCode={code})")

    stripped = body.lstrip()
    if stripped.startswith("{"):
        payload = json.loads(stripped)
        result = payload.get("RESULT") or payload.get("result") or {}
        for name in ("OIL", "oil", "AREA", "area"):
            rows = result.get(name)
            if isinstance(rows, list):
                return rows
        items = (((payload.get("response") or {}).get("body") or {}).get("items")) or {}
        rows = items.get("item") if isinstance(items, dict) else items
        return rows if isinstance(rows, list) else ([rows] if rows else [])

    try:
        root = ET.fromstring(stripped)
    except ET.ParseError:
        raise RuntimeError(f"응답을 해석할 수 없다: {stripped[:200]}")
    return [{child.tag: (child.text or "").strip() for child in item} for item in root.iter("item")] or [
        {child.tag: (child.text or "").strip() for child in oil} for oil in root.iter("OIL")
    ]


def fetch_areas(key: str) -> list[dict]:
    """시도 → 시군구 지역코드. place 서비스를 부르지 않고 이 코드계를 그대로 쓴다."""
    areas: list[dict] = []
    for row in _rows(_fetch("area_code", {"area": "SIDO"}, key)):
        code = str(row.get("AREA_CD") or row.get("areaCd") or "").strip()
        name = str(row.get("AREA_NM") or row.get("areaNm") or "").strip()
        if not code:
            continue
        areas.append({"code": code, "name": name, "level": "SIDO", "parent": None})
        for child in _rows(_fetch("area_code", {"area": "SIGUN", "code": code}, key)):
            child_code = str(child.get("AREA_CD") or child.get("areaCd") or "").strip()
            if not child_code:
                continue
            areas.append({
                "code": child_code,
                "name": str(child.get("AREA_NM") or child.get("areaNm") or "").strip(),
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


def _number(row: dict, *keys: str) -> float | None:
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
    """원천 한 줄 → 적재용 dict.

    좌표는 **변환하지 않고 그대로 넘긴다.** 원천이 KATEC 으로 줄 때와 위경도로 줄 때가 있어
    판정과 변환은 호출자(main)가 한 곳에서 한다.

    `opinetId` 가 없으면 그 줄을 버린다. 대체 키를 만들어 채우면 매일 다른 키가 생겨
    **모든 주유소가 매일 신규 진입(NEW)** 으로 보이고, 등락이 통째로 거짓이 된다.
    """
    price = _number(row, "PRICE", "price")
    return {
        "opinetId": str(row.get("UNI_ID") or row.get("uniId") or "").strip(),
        "name": str(row.get("OS_NM") or row.get("osNm") or "").strip(),
        "brandCode": (str(row.get("POLL_DIV_CD") or row.get("POLL_DIV_CO") or row.get("pollDivCd") or "").strip() or None),
        "isSelf": _flag(row, "SELF_YN", "selfYn") or False,
        "katecX": _number(row, "GIS_X_COOR", "gisXCoor"),
        "katecY": _number(row, "GIS_Y_COOR", "gisYCoor"),
        # 포털 설명이 "위치정보(위도·경도)" 라고 적힌 오퍼레이션도 있다 — 오면 그대로 쓴다
        "latitude": _number(row, "LAT", "lat", "latitude"),
        "longitude": _number(row, "LON", "lng", "longitude"),
        "areaCode": (area or {}).get("code"),
        "areaName": (area or {}).get("name"),
        "roadAddress": (str(row.get("NEW_ADR") or row.get("newAdr") or "").strip() or None),
        "jibunAddress": (str(row.get("VAN_ADR") or row.get("vanAdr") or "").strip() or None),
        "tel": (str(row.get("TEL") or row.get("tel") or "").strip() or None),
        "hasCarWash": _flag(row, "CAR_WASH_YN", "carWashYn"),
        "hasMaintenance": _flag(row, "MAINT_YN", "maintYn"),
        "hasCvs": _flag(row, "CVS_YN", "cvsYn"),
        "prices": [{"productCode": product_code, "price": int(price)}] if price else [],
    }


def fetch_area_top(key: str, area: dict, product_code: str) -> list[dict]:
    """한 지역 × 한 유종의 **최저가 상위 20곳**. 포털에서 가격을 주는 지역 단위 오퍼레이션이다."""
    body = _fetch("low_top", {"area": area["code"], "prodcd": product_code, "cnt": "20"}, key)
    parsed = [parse_station(row, product_code, area) for row in _rows(body)]
    return [row for row in parsed if row["opinetId"]]
