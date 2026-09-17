"""관광지 인기 집계 조회 (ADR-0095).

`links` 잡이 **한정된 예산을 어디에 쓸지** 정하는 근거다. YouTube search.list 는 하루 100건
(10,000 units ÷ 건당 100)이라 관광지 59,735곳 전량에 약 1.6년이 걸린다 — 아무 순서로나
쓰면 사람이 보는 곳이 뒤로 밀린다.

**공용 원장(`analytics.events`)이 아니라 전용 표만 읽는다.** 원장 스키마가 바뀌어도
집계 표 계약만 지키면 안 깨진다 (`recommendation` 이 `recommendation_*` 를 읽는 것과 같은 형태).

드라이버를 붙이지 않고 **ClickHouse HTTP 인터페이스**를 쓴다 — 표준 라이브러리로 충분하고
이미지에 의존성이 늘지 않는다.
"""
from __future__ import annotations

import os
import time
import urllib.error
import urllib.parse
import urllib.request

from src.backfill_overview import log

#: 기본 주소. 클러스터 안에서만 닿는다.
CLICKHOUSE_URL = os.environ.get("CLICKHOUSE_URL", "http://clickhouse:8123")

#: 연결 거부 재시도 간격(초). place_client 와 같은 값 — 같은 원인(정책 등록 지연)이다.
CONNECT_RETRIES = (2, 4, 8, 16)

#: 며칠치를 합쳐 볼지. 하루만 보면 그날 우연히 안 열린 곳이 영영 밀린다.
WINDOW_DAYS = int(os.environ.get("POPULARITY_WINDOW_DAYS", "14"))


def _get_with_connect_retry(url: str) -> str | None:
    """연결 자체가 안 되는 오류만 재시도한다. 서버가 답한 것(HTTP 4xx/5xx)은 그대로 실패다.

    **place_client 와 같은 이유다**: k3s 의 NetworkPolicy 컨트롤러가 새 파드를 허용 목록에
    올리는 데 몇 초가 걸리고, 이 잡은 뜨자마자 ClickHouse 를 부른다. 그 창에서
    `Connection refused` 를 맞는다 — 같은 라벨의 파드가 몇 초 뒤엔 200 을 받는 것을
    실측했다 (2026-09-17). 재시도 없이 빈 목록으로 가면 **매 회차가 인기순 없이 돌면서도
    로그엔 "조회 실패" 한 줄뿐**이라 오래 묻힌다.
    """
    for attempt, wait in enumerate((*CONNECT_RETRIES, None)):
        try:
            with urllib.request.urlopen(url, timeout=20) as res:
                return res.read().decode("utf-8")
        except urllib.error.HTTPError as e:
            # 서버가 답했다 — 정책이 아니라 질의 문제다. 재시도해도 같다.
            log(f"[popularity] 조회 거부 HTTP {e.code} — 인기순 없이 진행한다")
            return None
        except (urllib.error.URLError, TimeoutError, ConnectionError, OSError) as e:
            if wait is None:
                log(f"[popularity] 조회 실패 — 인기순 없이 진행한다: {e}")
                return None
            log(f"[popularity] 연결 실패(시도 {attempt + 1}): {e} — {wait}s 후 재시도")
            time.sleep(wait)
    return None


def top_attraction_ids(limit: int, window_days: int = WINDOW_DAYS) -> list[int]:
    """인기순 관광지 id. 조회 실패는 **빈 목록**이다 — 수집을 막지 않는다.

    집계가 아직 없을 수도 있고(첫 배포) ClickHouse 가 잠깐 없을 수도 있다. 그때는
    호출부가 기존 순서(원장 없이 place 가 정하는 순서)로 계속 간다.
    """
    query = (
        "SELECT attraction_id FROM analytics.attraction_popularity_daily "
        f"WHERE day >= today() - {int(window_days)} "
        "GROUP BY attraction_id "
        # 클릭이 노출보다 강한 신호다 — 본 사람 중 실제로 들어간 곳을 앞에 둔다.
        "ORDER BY sum(clicks) DESC, sum(impressions) DESC "
        f"LIMIT {int(limit)} FORMAT TabSeparated"
    )
    url = f"{CLICKHOUSE_URL}/?{urllib.parse.urlencode({'query': query})}"
    body = _get_with_connect_retry(url)
    if body is None:
        return []

    ids: list[int] = []
    for line in body.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            ids.append(int(line))
        except ValueError:
            continue
    return ids
