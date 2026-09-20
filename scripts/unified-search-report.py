#!/usr/bin/env python3
"""통합 검색 계측 리포트 — 노출·클릭 원장(ADR-0095)에 남은 것으로 남은 작업을 정한다.

    python3 scripts/unified-search-report.py                 # 최근 14일
    python3 scripts/unified-search-report.py --days 30
    python3 scripts/unified-search-report.py --sql            # 질의문만 출력(직접 붙여 쓸 때)

ClickHouse 는 클러스터 안에만 있어 노드를 거쳐 묻는다(`ssh <host> kubectl exec … clickhouse-client`).

**이 리포트가 답하는 것** — 플랜 `2026-09-09-search-architecture-graph.md` §2 S4 의 보류 항목들이다.

| 표 | 무엇을 정하나 |
|---|---|
| 미스 질의 | 결과가 한 건도 안 보인 질의 — 사전·동의어를 더할 자리 |
| 이해된 타입 | 타입 의도(「블로그 …」)가 실제로 쓰이는지 |
| 묶음별 CTR | 어느 타입이 눌리나. 관광지 묶음이 잡음이면 여기서 드러난다 |
| 묶음 순서 | 위에 둔 묶음이 실제로 눌리는지 — 순서 규칙의 검사 |
| 클릭 위치 | 1위만 눌리면 묶음당 5건은 과하고, 뒤가 눌리면 더 보여야 한다 |

숫자가 적으면 그대로 적는다 — **표본이 작다는 사실도 결론이다**(며칠 더 기다린다).
"""
from __future__ import annotations

import argparse
import shlex
import subprocess
import sys

SCREEN = "UNIFIED_SEARCH"

QUERIES: list[tuple[str, str]] = [
    (
        "전체",
        """
        SELECT countIf(action='SEARCH') AS searches, countIf(action='IMPRESSION') AS impressions,
               countIf(action='CLICK') AS clicks, uniq(visitor_id) AS visitors, uniq(view_id) AS views
        FROM analytics.events
        WHERE screen_type = '{screen}' AND timestamp >= now() - INTERVAL {days} DAY
        """,
    ),
    (
        "미스 질의 — 노출이 한 건도 안 붙은 검색 (상위 20)",
        """
        SELECT s.entity_id AS query, count() AS times
        FROM analytics.events AS s
        WHERE s.screen_type = '{screen}' AND s.action = 'SEARCH'
          AND s.timestamp >= now() - INTERVAL {days} DAY
          AND s.view_id NOT IN (
            SELECT view_id FROM analytics.events
            WHERE screen_type = '{screen}' AND action = 'IMPRESSION'
              AND timestamp >= now() - INTERVAL {days} DAY
          )
        GROUP BY query ORDER BY times DESC LIMIT 20
        """,
    ),
    (
        "이해된 타입 — 타입 의도가 쓰이나",
        """
        SELECT if(empty(screen_ref), '(없음)', screen_ref) AS understood_type, count() AS searches
        FROM analytics.events
        WHERE screen_type = '{screen}' AND action = 'SEARCH'
          AND timestamp >= now() - INTERVAL {days} DAY
        GROUP BY understood_type ORDER BY searches DESC
        """,
    ),
    (
        "묶음별 노출·클릭",
        """
        SELECT entity_type AS type, countIf(action='IMPRESSION') AS impressions, countIf(action='CLICK') AS clicks,
               round(100 * countIf(action='CLICK') / nullIf(countIf(action='IMPRESSION'), 0), 1) AS ctr_pct
        FROM analytics.events
        WHERE screen_type = '{screen}' AND action IN ('IMPRESSION','CLICK')
          AND timestamp >= now() - INTERVAL {days} DAY
        GROUP BY type ORDER BY impressions DESC
        """,
    ),
    (
        "묶음 순서 — 위에 둔 묶음이 눌리나",
        """
        SELECT section_index AS group_rank, countIf(action='IMPRESSION') AS impressions, countIf(action='CLICK') AS clicks,
               round(100 * countIf(action='CLICK') / nullIf(countIf(action='IMPRESSION'), 0), 1) AS ctr_pct
        FROM analytics.events
        WHERE screen_type = '{screen}' AND action IN ('IMPRESSION','CLICK')
          AND timestamp >= now() - INTERVAL {days} DAY
        GROUP BY group_rank ORDER BY group_rank
        """,
    ),
    (
        "클릭 위치 — 묶음 안 몇 번째가 눌리나",
        """
        SELECT item_index AS position_in_group, count() AS clicks
        FROM analytics.events
        WHERE screen_type = '{screen}' AND action = 'CLICK'
          AND timestamp >= now() - INTERVAL {days} DAY
        GROUP BY position_in_group ORDER BY position_in_group
        """,
    ),
]


def run(host: str, sql: str) -> str:
    inner = (
        "P=$(sudo kubectl -n commerce get pod -l app.kubernetes.io/name=clickhouse -o name | head -1); "
        f"sudo kubectl -n commerce exec $P -- clickhouse-client --format PrettyCompact -q {shlex.quote(sql)}"
    )
    # 컬럼 별칭은 ASCII 다 — 원격 셸을 거치며 한글 SQL 이 깨져 `Unrecognized token` 이 났다(실측).
    # 출력도 바이트로 받아 직접 디코드한다: 리포트가 죽는 것보다 글자 하나가 깨지는 편이 낫다.
    out = subprocess.run(
        ["ssh", "-o", "BatchMode=yes", "-o", "ConnectTimeout=10", host, inner],
        capture_output=True, timeout=180,
    )
    text = (out.stdout or out.stderr).decode("utf-8", errors="replace").rstrip()
    return text or "(행 없음)"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default="msa-oci", help="ClickHouse 가 도는 노드의 ssh 이름")
    ap.add_argument("--days", type=int, default=14)
    ap.add_argument("--sql", action="store_true", help="질의문만 출력한다")
    args = ap.parse_args()

    for title, template in QUERIES:
        sql = " ".join(template.format(screen=SCREEN, days=args.days).split())
        print(f"\n## {title}")
        if args.sql:
            print(sql)
            continue
        print(run(args.host, sql))
    return 0


if __name__ == "__main__":
    sys.exit(main())
