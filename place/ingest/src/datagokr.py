"""data.go.kr 공통 GET — 2단계 공공데이터 수집기가 같이 쓴다.

지키는 것:
  - **예산 상수가 상한이다.** 한도는 API(오퍼레이션 묶음)마다 하루 1,000(대기 500)이고, `quota.py` 의
    `DATA_GO_KR` 는 키 단위 관측이라 API 별 한도를 가르지 못한다. 잡이 정한 예산을 넘는 호출은 보내지 않는다.
  - **한도 초과는 그 API 를 그날 멈춘다.** HTTP 429 또는 `resultCode=22`(`LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR`).
    한도는 그날 안에 회복되지 않아 더 불러 봐야 시간만 쓴다. 이미 받은 몫은 반영한다.
  - **한 단위가 실패해도 다음 단위는 받는다**(`run_units`). 실패한 단위는 이름을 남기고 이전 값은 지우지 않는다.
  - 호출 수를 센다 — 잡 로그에 API · 호출 수 · 적재 건수 · 실패 단위를 남긴다.

키는 Encoding 키다. 이미 URL 인코딩돼 있으므로 그대로 붙인다(다시 인코딩하면 401).
"""
from __future__ import annotations

import json
import re
import time
from dataclasses import dataclass, field
from typing import Callable, Iterable
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import urlopen

BASE = "https://apis.data.go.kr"

#: 한도 초과 결과코드. 정상 봉투(`response.header.resultCode`)와 오류 봉투(`cmmMsgHeader.returnReasonCode`) 둘 다 이 값이다.
LIMIT_CODES = frozenset({"22"})
_OK_CODES = frozenset({"0000", "00"})
_XML_REASON = re.compile(r"<returnReasonCode>\s*(\d+)\s*</returnReasonCode>")
_XML_MSG = re.compile(r"<returnAuthMsg>\s*([^<]*)</returnAuthMsg>")


class QuotaExceeded(RuntimeError):
    """그 API 의 오늘 한도가 끝났다 — 같은 API 를 더 부르지 않는다."""


class BudgetExhausted(RuntimeError):
    """잡이 정한 예산을 다 썼다 — 한도와 달리 원천이 거부한 것이 아니다."""


class DataGoKrError(RuntimeError):
    """원천이 정상 응답이 아닌 것을 줬다(키 오류·형식 오류 등). 그 단위만 실패로 친다."""


def _http_get(url: str) -> tuple[int, str]:
    try:
        with urlopen(url, timeout=60) as res:
            return res.status, res.read().decode("utf-8")
    except HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")


def parse(status: int, text: str, label: str) -> dict:
    """응답 → `response.body`. 한도 초과면 [QuotaExceeded], 그 밖의 비정상이면 [DataGoKrError].

    data.go.kr 은 봉투가 두 종류다 — 정상 경로는 `response.header`, 키·한도 오류는
    `OpenAPI_ServiceResponse.cmmMsgHeader` 이고 `_type=json` 을 줘도 XML 로 올 때가 있다.
    """
    if status == 429:
        raise QuotaExceeded(f"[{label}] HTTP 429")
    stripped = text.lstrip()
    if stripped.startswith("<"):
        reason = _XML_REASON.search(stripped)
        code = reason.group(1) if reason else None
        if code in LIMIT_CODES:
            raise QuotaExceeded(f"[{label}] resultCode={code}")
        msg = _XML_MSG.search(stripped)
        raise DataGoKrError(f"[{label}] XML 오류 봉투 code={code} {msg.group(1).strip() if msg else ''}".rstrip())
    if status >= 400:
        raise DataGoKrError(f"[{label}] HTTP {status}: {stripped[:160]}")
    try:
        data = json.loads(stripped)
    except json.JSONDecodeError as e:
        raise DataGoKrError(f"[{label}] JSON 이 아니다: {stripped[:160]}") from e

    fault = (data.get("OpenAPI_ServiceResponse") or {}).get("cmmMsgHeader")
    if fault:
        code = str(fault.get("returnReasonCode") or "")
        if code in LIMIT_CODES:
            raise QuotaExceeded(f"[{label}] resultCode={code}")
        raise DataGoKrError(f"[{label}] 거부 {code} {fault.get('returnAuthMsg') or fault.get('errMsg') or ''}".rstrip())

    header = (data.get("response") or {}).get("header") or {}
    code = str(header.get("resultCode") or "")
    if code in LIMIT_CODES:
        raise QuotaExceeded(f"[{label}] resultCode={code}")
    if code not in _OK_CODES:
        raise DataGoKrError(f"[{label}] 실패 {code or '응답 형식을 모르겠다'} {header.get('resultMsg') or stripped[:160]}")
    return (data.get("response") or {}).get("body") or {}


def items(body: dict) -> list[dict]:
    """원천은 0건이면 빈 문자열, 1건이면 dict, 여러 건이면 list 로 준다."""
    holder = body.get("items") or {}
    item = holder.get("item") if isinstance(holder, dict) else None
    if not item:
        return []
    return [item] if isinstance(item, dict) else list(item)


@dataclass
class Client:
    """API 하나의 호출기. `budget` 은 이 실행에서 보낼 수 있는 호출 수 상한이다."""

    key: str
    api: str
    budget: int
    gap_sec: float = 0.05
    fetch: Callable[[str], tuple[int, str]] = _http_get
    calls: int = 0
    stopped: str | None = None

    def get(self, path: str, params: dict, label: str | None = None) -> dict:
        """`{BASE}/{path}` 를 부른다. 한도 초과를 한 번 받으면 이후 호출은 보내지 않고 같은 예외를 낸다."""
        if self.stopped:
            raise QuotaExceeded(f"[{self.api}] 이미 멈췄다 — {self.stopped}")
        if self.calls >= self.budget:
            raise BudgetExhausted(f"[{self.api}] 예산 {self.budget}콜을 다 썼다")
        qs = urlencode(params)
        url = f"{BASE}/{path}?serviceKey={self.key}&{qs}"
        self.calls += 1
        status, text = self.fetch(url)
        try:
            return parse(status, text, label or self.api)
        except QuotaExceeded as e:
            self.stopped = str(e)
            raise
        finally:
            if self.gap_sec:
                time.sleep(self.gap_sec)


@dataclass
class UnitRun:
    """`run_units` 결과 — 받은 몫 · 실패한 단위 · 멈춘 이유(한도·예산, 없으면 None)."""

    results: dict = field(default_factory=dict)
    failed: list = field(default_factory=list)
    stopped: str | None = None


def run_units(units: Iterable, fetch_one: Callable, log: Callable[[str], None] = print) -> UnitRun:
    """단위(시군구·관광지 …)마다 `fetch_one(unit)` 를 부른다.

    - 한 단위의 예외는 그 단위만 실패로 남기고 다음 단위로 간다.
    - 한도 초과·예산 소진은 거기서 멈추고 **이미 받은 몫을 돌려준다** — 호출부가 그 몫을 반영한다.
    """
    run = UnitRun()
    for unit in units:
        try:
            run.results[unit] = fetch_one(unit)
        except (QuotaExceeded, BudgetExhausted) as e:
            run.stopped = str(e)
            log(f"  멈춤 — {e} (받은 단위 {len(run.results):,})")
            break
        except Exception as e:                              # noqa: BLE001 — 단위별 격리
            run.failed.append(unit)
            log(f"  {unit} 실패 — 다음 단위는 계속 받는다: {e}")
    return run
