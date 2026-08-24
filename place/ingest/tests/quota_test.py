#!/usr/bin/env python3
"""쿼터 장부 — 키 포맷이 JVM 과 같은지 고정한다 (ADR-0082).

    cd place/ingest && python3 -m tests.quota_test

여기서 잡으려는 것은 하나다: **키 포맷이 어긋나면 합산이 조용히 깨진다.**
양쪽 다 자기 키만 보며 정상 동작하므로, 어긋난 걸 알아챌 방법이 이 테스트뿐이다.
같은 값을 common/src/test/.../ExternalApiQuotaLedgerSpec.kt 도 검사한다.
"""
from __future__ import annotations

import datetime as dt
import sys

from src.quota import DAILY_LIMIT, GOOGLE_PLACES, NAVER_SEARCH, QuotaLedger, key_of

failures = []


def check(label, actual, expected):
    if actual != expected:
        failures.append(f"{label}: {actual!r} != {expected!r}")


# ── 키 포맷 (JVM ExternalApiQuotaLedgerSpec 와 같은 기대값) ──
check("naver key",
      key_of(NAVER_SEARCH, dt.date(2026, 8, 24)),
      "external-api-quota:naver-search:2026-08-24")
check("places key",
      key_of(GOOGLE_PLACES, dt.date(2026, 1, 5)),
      "external-api-quota:google-places:2026-01-05")

# ── 한도 표가 JVM enum 과 같은 값인가 ──
check("naver limit", DAILY_LIMIT[NAVER_SEARCH], 25_000)
check("places limit", DAILY_LIMIT[GOOGLE_PLACES], 1_000)

# ── REDIS_HOST 미설정이면 비활성 — 수집을 막지 않는다 ──
ledger = QuotaLedger(host=None)
check("disabled passes", ledger.try_acquire(NAVER_SEARCH), True)
check("disabled used", ledger.used(NAVER_SEARCH), 0)

# ── 붙을 수 없는 주소면 fail-open ──
unreachable = QuotaLedger(host="127.0.0.1", port=1)
check("fail-open", unreachable.try_acquire(NAVER_SEARCH), True)

if failures:
    print("FAIL")
    for f in failures:
        print(" -", f)
    sys.exit(1)
print(f"OK — {6 - len(failures)} checks")
