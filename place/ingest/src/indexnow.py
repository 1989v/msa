"""IndexNow 제출 — 지난 24시간 동안 본문이 바뀐 관광지 상세 주소를 검색엔진에 알린다.

place 내부 조회(`/internal/attractions/content-updated`)로 `[실행 시각(KST) − 24h, 실행 시각)` 창의 id 를 모아
`https://api.indexnow.org/indexnow` 에 10,000건씩 보낸다. 저장처가 없어 하루 실패하면 그날 변경은 빠진다 —
RSS·sitemap 에는 남으므로 받아들인다.

- `INDEXNOW_ENABLED` 가 "true" 가 아니면 보내지 않고 건수만 남긴다(기본 꺼짐).
- 응답이 무엇이든 잡은 성공으로 끝낸다 — 알림이 안 갔다고 수집 파드를 실패로 표시할 일이 아니다.
- 키와 요청 본문은 로그에 쓰지 않는다. 키는 공개 파일이지만 로그에 남길 이유가 없다.
"""
from __future__ import annotations

import json
import os
import socket
import urllib.error
import urllib.request
from datetime import datetime, timedelta

from src import place_client, sync_tour

ENDPOINT = "https://api.indexnow.org/indexnow"
HOST = "place.1989v.com"
BATCH = 10_000          # IndexNow 요청당 URL 상한
TIMEOUT_SEC = 30
PAGE_SIZE = 1000        # place 내부 조회의 쪽당 상한
WINDOW = timedelta(hours=24)

_STATUS_TEXT = {
    200: "성공",
    202: "접수 — 키 검증 대기",
    400: "400 요청 형식 오류",
    403: "403 키 불일치 — 키 파일 확인",
    422: "422 주소가 host·키와 맞지 않음",
    429: "429 요청 과다",
}


def log(msg: str) -> None:
    print(f"[indexnow] {msg}", flush=True)


def window(now: datetime) -> tuple[str, str]:
    """`[now − 24h, now)` — place 가 받는 오프셋 없는 ISO(서울 시각), 초 단위."""
    until = now.replace(microsecond=0)
    return (until - WINDOW).isoformat(), until.isoformat()


def collect(since: str, until: str) -> list[dict]:
    items: list[dict] = []
    after_id = 0
    while True:
        data = place_client.content_updated(since, until, after_id, PAGE_SIZE)
        got = data.get("items") or []
        items.extend(got)
        nxt = data.get("nextAfterId")
        if not got or nxt is None:
            return items
        if int(nxt) <= after_id:
            raise RuntimeError(f"[indexnow] 키셋이 앞으로 가지 않는다: afterId={after_id}, next={nxt}")
        after_id = int(nxt)


def url_of(item: dict) -> str:
    prefix = "/en" if item.get("lang") == "en" else ""
    return f"https://{HOST}{prefix}/attractions/{int(item['id'])}"


def _post(key: str, urls: list[str]) -> str:
    body = json.dumps({"host": HOST, "key": key, "keyLocation": f"https://{HOST}/{key}.txt",
                       "urlList": urls}).encode()
    req = urllib.request.Request(ENDPOINT, data=body, method="POST",
                                 headers={"Content-Type": "application/json; charset=utf-8"})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SEC) as r:
            code = r.status
    except urllib.error.HTTPError as e:
        code = e.code
    except (TimeoutError, socket.timeout):
        return f"타임아웃({TIMEOUT_SEC}초)"
    except urllib.error.URLError as e:
        if isinstance(e.reason, (TimeoutError, socket.timeout)):
            return f"타임아웃({TIMEOUT_SEC}초)"
        return f"연결 실패 — {type(e.reason).__name__}"
    return _STATUS_TEXT.get(code, f"{code} 예상 밖 응답")


def run(now: datetime | None = None) -> int:
    now = now or datetime.now(sync_tour.KST).replace(tzinfo=None)
    since, until = window(now)
    urls = [url_of(it) for it in collect(since, until)]
    log(f"창 {since} ~ {until} (KST)")
    if os.environ.get("INDEXNOW_ENABLED", "false").strip().lower() != "true":
        log(f"IndexNow 비활성 — 보낼 주소 {len(urls):,}건")
        return 0
    if not urls:
        log("IndexNow 대상 0건")
        return 0
    key = os.environ.get("INDEXNOW_KEY") or ""
    if not key:
        log(f"IndexNow 키 없음 — 보낼 주소 {len(urls):,}건")
        return 0
    for i in range(0, len(urls), BATCH):
        chunk = urls[i:i + BATCH]
        log(f"IndexNow {i // BATCH + 1}번째 묶음 {len(chunk):,}건 — {_post(key, chunk)}")
    return 0
