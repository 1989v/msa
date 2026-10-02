"""data.go.kr 공통 틀 — 한도 초과 판정 · 예산 상한 · 단위별 실패 격리 · 외부 egress 범위."""
from __future__ import annotations

import json
import re
from pathlib import Path

import pytest

from src import barrier_free, datagokr, place_client
from tests.fixture_rows import load

SAMPLE = load("phase2-barrier-free-wellness.json")
REPO = next(p for p in Path(__file__).resolve().parents if (p / "settings.gradle.kts").is_file())


def ok_body(items: list[dict], total: int | None = None) -> str:
    """정상 봉투 — 2026-10-02 운영 응답과 같은 모양(`response.header.resultCode=0000` · `body.items.item`)."""
    return json.dumps({"response": {"header": {"resultCode": "0000", "resultMsg": "OK"},
                                    "body": {"items": {"item": items}, "numOfRows": len(items), "pageNo": 1,
                                             "totalCount": len(items) if total is None else total}}},
                      ensure_ascii=False)


# data.go.kr 공통 오류 봉투(포털 활용가이드의 「OpenAPI 에러 코드」 형식). 22 = LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR
LIMIT_XML = ("<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE ERROR</errMsg>"
             "<returnAuthMsg>LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR</returnAuthMsg>"
             "<returnReasonCode>22</returnReasonCode></cmmMsgHeader></OpenAPI_ServiceResponse>")
KEY_XML = LIMIT_XML.replace("LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR", "SERVICE_KEY_IS_NOT_REGISTERED_ERROR").replace(">22<", ">30<")
LIMIT_JSON = json.dumps({"response": {"header": {"resultCode": "22", "resultMsg": "LIMITED_NUMBER_OF_SERVICE_REQUESTS_EXCEEDS_ERROR"}}})


class Recorder:
    """보낸 URL 을 세는 가짜 원천. `replies` 를 순서대로 돌려준다."""

    def __init__(self, replies: list[tuple[int, str]]):
        self.replies = list(replies)
        self.sent: list[str] = []

    def __call__(self, url: str) -> tuple[int, str]:
        self.sent.append(url)
        return self.replies.pop(0)


@pytest.mark.parametrize("reply", [(429, "Too Many Requests"), (200, LIMIT_XML), (200, LIMIT_JSON)])
def test_quota_signals_stop_the_api_and_later_calls_are_not_sent(reply):
    fake = Recorder([reply, (200, ok_body([]))])
    client = datagokr.Client(key="K", api="X", budget=10, gap_sec=0, fetch=fake)
    with pytest.raises(datagokr.QuotaExceeded):
        client.get("B551011/X/op", {})
    with pytest.raises(datagokr.QuotaExceeded):
        client.get("B551011/X/op", {})
    assert len(fake.sent) == 1


def test_other_faults_are_errors_not_quota():
    for reply in [(200, KEY_XML), (500, "oops"), (200, "not json")]:
        client = datagokr.Client(key="K", api="X", budget=10, gap_sec=0, fetch=Recorder([reply]))
        with pytest.raises(datagokr.DataGoKrError):
            client.get("B551011/X/op", {})
        assert client.stopped is None


def test_budget_is_an_upper_bound_on_calls_sent():
    fake = Recorder([(200, ok_body([]))] * 5)
    client = datagokr.Client(key="K", api="X", budget=2, gap_sec=0, fetch=fake)
    client.get("p", {})
    client.get("p", {})
    with pytest.raises(datagokr.BudgetExhausted):
        client.get("p", {})
    assert len(fake.sent) == 2 and client.calls == 2


def test_key_is_appended_as_given_not_reencoded():
    fake = Recorder([(200, ok_body([]))])
    datagokr.Client(key="ab%2Bcd%3D%3D", api="X", budget=1, gap_sec=0, fetch=fake).get("B551011/X/op", {"a": "1"})
    assert "serviceKey=ab%2Bcd%3D%3D&a=1" in fake.sent[0]


def test_one_failed_unit_does_not_block_the_next_and_quota_returns_what_was_received():
    calls = []

    def fetch_one(unit):
        calls.append(unit)
        if unit == "b":
            raise datagokr.DataGoKrError("b 만 실패")
        if unit == "d":
            raise datagokr.QuotaExceeded("한도")
        return unit.upper()

    run = datagokr.run_units(["a", "b", "c", "d", "e"], fetch_one, log=lambda _: None)
    assert run.results == {"a": "A", "c": "C"}
    assert run.failed == ["b"]
    assert run.stopped and "한도" in run.stopped
    assert calls == ["a", "b", "c", "d"]          # 한도 뒤의 e 는 부르지 않는다


def test_barrier_free_job_loads_received_details_when_quota_hits_midway(monkeypatch):
    """목록 1콜 → 상세 3번째에서 한도 → 앞의 둘은 적재되고 넷째는 부르지 않는다."""
    details = SAMPLE["details"][:4]
    replies = [(200, ok_body(SAMPLE["listRows"][:4], total=4)),
               (200, ok_body([details[0]])), (200, ok_body([details[1]])), (200, LIMIT_XML)]
    fake = Recorder(replies)
    pushed: list[list[dict]] = []
    monkeypatch.setattr(place_client, "put_barrier_free_list", lambda recs: {"matched": len(recs), "unmatched": 0})
    monkeypatch.setattr(place_client, "fetch_barrier_free_state", lambda: [
        {"contentId": d["contentid"], "listModifiedAt": None, "detailSyncedAt": None} for d in details])
    monkeypatch.setattr(place_client, "put_barrier_free_details", lambda recs: pushed.append(recs) or len(recs))

    client = datagokr.Client(key="K", api=barrier_free.API, budget=barrier_free.DAILY_BUDGET, gap_sec=0, fetch=fake)
    summary = barrier_free.run("K", client=client)

    assert len(fake.sent) == 4
    picked = barrier_free.pick_details(
        [{"contentId": d["contentid"], "detailSyncedAt": None} for d in details], 10)
    assert len(pushed) == 1 and [r["contentId"] for r in pushed[0]] == picked[:2]
    assert summary["details"] == 2 and summary["stopped"] and not summary["failed"]


def _public_egress_selectors() -> dict[str, set[str]]:
    """외부(0.0.0.0/0) egress 를 여는 NetworkPolicy → 그 정책이 고르는 app 이름."""
    found: dict[str, set[str]] = {}
    for path in (REPO / "k8s").rglob("*.yaml"):
        for doc in path.read_text(encoding="utf-8").split("\n---"):
            if "kind: NetworkPolicy" not in doc or "0.0.0.0/0" not in doc:
                continue
            spec = doc.split("policyTypes")[0]
            names = set()
            for values in re.findall(r"values:\s*\[([^\]]*)\]", spec):
                names |= {v.strip() for v in values.split(",") if v.strip()}
            names |= set(re.findall(r"app\.kubernetes\.io/name:\s*([\w-]+)", spec.split("podSelector", 1)[-1]))
            found[str(path.relative_to(REPO))] = names
    return found


def test_only_place_ingest_reaches_public_internet_among_place_and_search_pods():
    selectors = _public_egress_selectors()
    assert any("place-ingest" in names for names in selectors.values())
    forbidden = {"content", "place", "search", "search-batch", "search-consumer"}
    leaks = {path: names & forbidden for path, names in selectors.items() if names & forbidden}
    assert leaks == {}
